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
            "name": "_owner",
            "type": "address"
          }
        ],
        "name": "withdraw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
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
        "name": "buyBookmakerBet",
        "outputs": [],
        "payable": true,
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
            "name": "_group",
            "type": "uint256"
          },
          {
            "name": "_imdb",
            "type": "uint256"
          }
        ],
        "name": "closeBet",
        "outputs": [],
        "payable": false,
        "type": "function"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b610b1a806100186000396000f3606060405236156100555760e060020a6000350462f714ce811461005a57806301f9a3661461006f5780634086a98f146100875780636bdec961146100a95780638f352f60146100b9578063d38d75ae14610110575b610000565b346100005761006d600435602435610125565b005b346100005761006d60043560243560443561019d565b005b3461000057610097600435610284565b60408051918252519081900360200190f35b61006d600435602435610302565b005b34610000576100c6610381565b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b346100005761006d6004356024356103e2565b005b6000828152602081905260408082205481517f51cff8d9000000000000000000000000000000000000000000000000000000008152600160a060020a038581166004830152925192909116926351cff8d99260248084019382900301818387803b156100005760325a03f115610000575050505b5050565b82828233604051610631806104e98339019384526020840192909252604080840191909152600160a060020a0390911660608301525190819003608001906000f08015610000576000848152602081905260409020805473ffffffffffffffffffffffffffffffffffffffff19166c0100000000000000000000000092830292909204919091179055600180548082018083558281838015829011610267576000838152602090206102679181019083015b80821115610263576000815560010161024f565b5090565b5b505050916000526020600020900160005b50849055505b505050565b600081815260208181526040808320548151830184905281517fd4c5e23f0000000000000000000000000000000000000000000000000000000081529151600160a060020a039091169263d4c5e23f926004808201939182900301818787803b156100005760325a03f115610000575050604051519150505b919050565b6000818152602081905260408082205481517f2611fb9600000000000000000000000000000000000000000000000000000000815260048101869052600160a060020a03338116602483015292519290911692632611fb969260448084019382900301818387803b156100005760325a03f115610000575050505b5050565b6040805160208181018352600082526001805484518184028101840190955280855292939290918301828280156103d757602002820191906000526020600020905b8154815260200190600101908083116103c3575b505050505090505b90565b6000818152602081905260408082205481517f2a4adce000000000000000000000000000000000000000000000000000000000815260048101869052600160a060020a03338116602483015292519290911691632a4adce091604480820192869290919082900301818387803b156100005760325a03f115610000575050506000828152602081905260408120805473ffffffffffffffffffffffffffffffffffffffff1916905590505b60015481101561027f5781600182815481101561000057906000526020600020900160005b505414156104da57600181815481101561000057906000526020600020900160005b50600090555b5b60010161048d565b5b50505056606060405260405160808061063183398101604090815281516020830151918301516060909301519092905b60058481556003849055600283905560006008819055600a6020527fbbc70db1b6c7afd11e79c0fb0051300458f1a3acb8ee9789d9b6b26c61ad9bc78190557fbff4442b8ed600beeb8e26b1279a0f0d14c6edfaec26d968ee13c86f7d4c2ba881905560017fa856840544dc26124927add067d799967eac11be13e14d82cc281ea46fa397598190557fe1eb2b2161a492c07c5a334e48012567cba93ec021043f53c1955516a3c5a8418290559181527ff35035bc2b01d44bd35a1dcdc552315cffb73da35cfd60570b7b777f98036f9f819055600680549092019091558054600160a060020a0319166c01000000000000000000000000838102041790556007805460ff191690555b505050505b6104e9806101486000396000f3606060405236156100b95760e060020a6000350463228cb73381146100be5780632611fb96146100dd5780632a4adce0146100ed5780632ec692031461010257806338cc48311461012157806351cff8d91461014a578063597e1fb51461015c5780637ad4d0d21461017d578063893d20e81461019c57806389b597f3146101c55780638da5cb5b146101e45780639ba0bc1f1461020d578063d4c5e23f1461022c578063f512f5e71461024b578063f9facff01461026a575b610000565b34610000576100cb610289565b60408051918252519081900360200190f35b6100eb60043560243561028f565b005b34610000576100eb600435602435610359565b005b34610000576100cb6103ff565b60408051918252519081900360200190f35b346100005761012e610405565b60408051600160a060020a039092168252519081900360200190f35b34610000576100eb60043561040a565b005b346100005761016961049c565b604080519115158252519081900360200190f35b34610000576100cb6104a5565b60408051918252519081900360200190f35b346100005761012e6104ab565b60408051600160a060020a039092168252519081900360200190f35b34610000576100cb6104bb565b60408051918252519081900360200190f35b346100005761012e6104c1565b60408051600160a060020a039092168252519081900360200190f35b34610000576100cb6104d0565b60408051918252519081900360200190f35b34610000576100cb6104d6565b60408051918252519081900360200190f35b34610000576100cb6104dd565b60408051918252519081900360200190f35b34610000576100cb6104e3565b60408051918252519081900360200190f35b60045481565b6000548190600160a060020a03808316911614156102ac57610352565b6003543410156102ea57604051600160a060020a033316903480156108fc02916000818181858888f1935050505015156102e557610000565b610352565b6000838152600a6020908152604080832080546001908101909155600160a060020a033316808552600990935281842087905560068054909101905560035490519192349190910380156108fc02929091818181858888f19350505050151561035257610000565b5b5b505050565b600080548290600160a060020a03808316911614610376576103f7565b6007805460ff1916600117905560088490556064600160a060020a0330163104915060035430600160a060020a031631811561000057048230600160a060020a031631038115610000570460045560008054604051600160a060020a039091169184156108fc02918591818181858888f1935050505015156103f757610000565b5b5b50505050565b60055481565b305b90565b60075460ff16151561041b57610499565b6000548190600160a060020a038083169116141561043857610495565b600854600160a060020a03331660009081526009602052604090205414156100b957600454604051600160a060020a0333169180156108fc02916000818181858888f19350505050151561048b57610000565b610495565b610000565b5b5b505b50565b60075460ff1681565b60085481565b600054600160a060020a03165b90565b60025481565b600054600160a060020a031681565b60035481565b6002545b90565b60065481565b6001548156",
    "events": {},
    "updated_at": 1481757691861,
    "links": {},
    "address": "0x2904509f8995cdf879465bd948c32293f6e78ed0"
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
