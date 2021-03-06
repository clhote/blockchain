var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("BookmakerFactory error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("BookmakerFactory error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("BookmakerFactory contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of BookmakerFactory: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to BookmakerFactory.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: BookmakerFactory not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "_imdb",
            "type": "uint256"
          },
          {
            "name": "_valueBet",
            "type": "uint256"
          },
          {
            "name": "_betboxoffice",
            "type": "uint256"
          }
        ],
        "name": "createBookmaker",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getClosedBetNotOwner",
        "outputs": [
          {
            "name": "",
            "type": "uint256[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_imdb",
            "type": "uint256"
          }
        ],
        "name": "getInitialBet",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_group",
            "type": "uint256"
          },
          {
            "name": "_imdb",
            "type": "uint256"
          }
        ],
        "name": "closeBetFacto",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_group",
            "type": "uint256"
          },
          {
            "name": "_imdb",
            "type": "uint256"
          }
        ],
        "name": "buyBookmakerBet",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_imdb",
            "type": "uint256"
          }
        ],
        "name": "getValueBet",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_imdb",
            "type": "uint256"
          }
        ],
        "name": "withdrawBetFacto",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getIMDB",
        "outputs": [
          {
            "name": "",
            "type": "uint256[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_imdb",
            "type": "uint256"
          }
        ],
        "name": "getOwnerBet",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getNoIMDB",
        "outputs": [
          {
            "name": "",
            "type": "uint256[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getClosedBetOwner",
        "outputs": [
          {
            "name": "",
            "type": "uint256[]"
          }
        ],
        "payable": false,
        "type": "function"
      }
    ],
    "unlinked_binary": "0x606060405261112d806100126000396000f36060604052361561008d5760e060020a600035046301f9a36681146100925780631be497eb1461015c5780634086a98f146101bc5780634af12dcc146102475780636bdec961146103565780636e94783c146103de578063853c9a3b146104695780638f352f6014610471578063d0f3de4d146104c1578063e43b2be11461054c578063fe3406cf1461059c575b610002565b61046f6004356024356044356000339050838383836040516104ae80610c7f8339018085815260200184815260200183815260200182600160a060020a03168152602001945050505050604051809103906000f08015610002576000858152600260205260409020805473ffffffffffffffffffffffffffffffffffffffff19166c010000000000000000000000009283029290920491909117905560038054600181018083558281838015829011610662576000838152602090206106629181019083016101a8565b34610002576105ea60408051602081019091526000808252600180548282559082526106d0907fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6908101905b808211156106cc57600081556001016101a8565b34610002576106346004356000818152600260209081526040808320548151830184905281517fd4c5e23f0000000000000000000000000000000000000000000000000000000081529151600160a060020a039091169263d4c5e23f926004808201939182900301818787803b156100025760325a03f115610002575050604051519150505b919050565b346100025761046f6004356024356000818152600260205260408082205481517f2bf663710000000000000000000000000000000000000000000000000000000081526004810186905233600160a060020a03908116602483015292519290911692632bf663719260448084019382900301818387803b156100025760325a03f115610002575050506000818152600260209081526040808320546006909252909120805473ffffffffffffffffffffffffffffffffffffffff19166c01000000000000000000000000600160a060020a03909316830292909204919091179055600780546001810180835582818380158290116107f6576000838152602090206107f69181019083016101a8565b61046f6004356024356000818152600260205260408082205481517f2611fb960000000000000000000000000000000000000000000000000000000081526004810186905233600160a060020a03908116602483015292519290911692632611fb969260448084019382900301818387803b156100025760325a03f115610002575050505050565b34610002576106346004356000818152600260209081526040808320548151830184905281517f209652550000000000000000000000000000000000000000000000000000000081529151600160a060020a03909116926320965255926004808201939182900301818787803b156100025760325a03f1156100025750506040515191506102429050565b34610002575b005b34610002576105ea6040805160208101909152600080825260048054828255908252610809907f8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b908101906101a8565b34610002576106466004356000818152600260209081526040808320548151830184905281517f893d20e80000000000000000000000000000000000000000000000000000000081529151600160a060020a039091169263893d20e8926004808201939182900301818787803b156100025760325a03f1156100025750506040515191506102429050565b34610002576105ea6040805160208101909152600080825260058054828255908252610986907f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db0908101906101a8565b34610002576105ea604080516020810190915260008082528054818055818052610b02907f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563908101906101a8565b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b60408051918252519081900360200190f35b60408051600160a060020a039092168252519081900360200190f35b50505060009283525060209091200193909355505050565b60018054604080516020808402820181019092528281529291908301828280156106c457602002820191906000526020600020905b815481526001909101906020018083116106af575b505050505091505b5090565b50600090505b60075481101561067a5733600160a060020a031660066000506000600760005084815481101561000257906000526020600020900160005054815260200190815260200160002060009054906101000a9004600160a060020a0316600160a060020a031663893d20e86000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100025760325a03f11561000257505060405151600160a060020a03169190911490506107ee576001805480820180835582818380158290116107bd576000838152602090206107bd9181019083016101a8565b5050509190906000526020600020900160006007805485908110156100025760009182526020909120015490915550505b6001016106d6565b5050506000928352506020909120015550565b50600090505b6003548110156108f85733600160a060020a031660026000506000600360005084815481101561000257906000526020600020900160005054815260200190815260200160002060009054906101000a9004600160a060020a0316600160a060020a031663893d20e86000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100025760325a03f11561000257505060405151600160a060020a03169190911415905061097e576004805460018101808355828183801582901161094d5760008381526020902061094d9181019083016101a8565b60048054604080516020808402820181019092528281529291908301828280156106c45760200282019190600052602060002090815481526001909101906020018083116106af575b505050505091506106cc565b5050509190906000526020600020900160006003805485908110156100025760009182526020909120015490915550505b60010161080f565b50600090505b600354811015610a745733600160a060020a031660026000506000600360005084815481101561000257906000526020600020900160005054815260200190815260200160002060009054906101000a9004600160a060020a0316600160a060020a031663893d20e86000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100025760325a03f11561000257505060405151600160a060020a0316919091149050610afa5760058054600181018083558281838015829011610ac957600083815260209020610ac99181019083016101a8565b60058054604080516020808402820181019092528281529291908301828280156106c45760200282019190600052602060002090815481526001909101906020018083116106af575b505050505091506106cc565b5050509190906000526020600020900160006003805485908110156100025760009182526020909120015490915550505b60010161098c565b50600090505b600754811015610bf15733600160a060020a031660066000506000600760005084815481101561000257906000526020600020900160005054815260200190815260200160002060009054906101000a9004600160a060020a0316600160a060020a031663893d20e86000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100025760325a03f11561000257505060405151600160a060020a031691909114159050610c775760008054600181018083558281838015829011610c4657600083815260209020610c469181019083016101a8565b60008054604080516020808402820181019092528281529291908301828280156106c45760200282019190600052602060002090815481526001909101906020018083116106af575b505050505091506106cc565b5050509190906000526020600020900160006007805485908110156100025760009182526020909120015490915550505b600101610b085660606040526040516080806104ae833960e06040529051905160a05160c051600593845560039290925560025560006008819055600a6020527fbbc70db1b6c7afd11e79c0fb0051300458f1a3acb8ee9789d9b6b26c61ad9bc78190557fbff4442b8ed600beeb8e26b1279a0f0d14c6edfaec26d968ee13c86f7d4c2ba881905560017fa856840544dc26124927add067d799967eac11be13e14d82cc281ea46fa397598190557fe1eb2b2161a492c07c5a334e48012567cba93ec021043f53c1955516a3c5a8418290559281527ff35035bc2b01d44bd35a1dcdc552315cffb73da35cfd60570b7b777f98036f9f819055600680549093019092558154600160a060020a0319166c01000000000000000000000000918202919091041781556007805460ff1916905561037690819061013890396000f3606060405236156100c45760e060020a60003504632096525581146100c9578063228cb733146100d85780632611fb96146100e65780632bf663711461010d5780632ec692031461013757806338cc48311461014557806351cff8d914610153578063597e1fb51461016f5780637ad4d0d214610180578063893d20e81461018e57806389b597f3146101a75780638da5cb5b146101b55780639ba0bc1f146101cc578063d4c5e23f146101da578063f512f5e7146101ea578063f9facff0146101f8575b610002565b34610002576102066003545b90565b346100025761020660045481565b6102186004356024356000548190600160a060020a038083169116141561024a575b505050565b34610002576102186004356024356000548190600160a060020a038083169116146102eb57610108565b346100025761020660055481565b346100025761021a306100d5565b346100025761021860043560075460ff16151561030557610320565b346100025761023660075460ff1681565b346100025761020660085481565b346100025761021a600054600160a060020a03166100d5565b346100025761020660025481565b346100025761021a600054600160a060020a031681565b346100025761020660035481565b34610002576102066002546100d5565b346100025761020660065481565b346100025761020660015481565b60408051918252519081900360200190f35b005b60408051600160a060020a039092168252519081900360200190f35b604080519115158252519081900360200190f35b60035434101561028357604051600160a060020a038316903480156108fc02916000818181858888f19350505050151561010857610002565b6000838152600a6020908152604080832080546001908101909155600160a060020a038616808552600990935281842087905560068054909101905560035490519192349190910380156108fc02929091818181858888f19350505050151561010857610002565b50506007805460ff19166001179055600855600354600455565b6000548190600160a060020a0380831691161415610323575b505b50565b600854600160a060020a03831660009081526009602052604090205414156100c457600454604051600160a060020a0384169180156108fc02916000818181858888f19350505050151561031e5761000256",
    "events": {},
    "updated_at": 1481979268971,
    "links": {},
    "address": "0xb718f483fe7110f165e38918d5c291608fb5bf9d"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "BookmakerFactory";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.BookmakerFactory = Contract;
  }
})();
