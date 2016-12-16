pragma solidity ^0.4.0;

//import "github.com/oraclize/ethereum-api/oraclizeAPI.sol";

contract Bookmaker  {
    address public owner;
    
    uint public resultBoxOffice;
    uint public betBoxOffice; 
    uint public valueBet;
    uint public reward;
    uint public imdb;
    
    
    
    // A TEJ
    
    
    uint public nbrVoters;
    
    
    
    // A TEJ
    
    
    bool public closed;
    uint public winnerGroup;
    
    mapping (address => uint) bets;
    mapping (uint => uint) group;
   // event newOraclizeQuery(string description);

    function Bookmaker(uint _imdb, uint _valueBet, uint _betboxoffice, address _owner) {
        imdb = _imdb;
        valueBet = _valueBet;
        betBoxOffice = _betboxoffice;
        
        winnerGroup = 0;

        group[1] = 0;
        group[2] = 0;
        group[3] = 1;
        group[4] = 0;
        group[5] = 0;
        
        // A TEJ
        nbrVoters++;
        
        owner = _owner;
        closed = false;
        
       // oraclize_query(2, "URL", strConcat("http://gautierdelache.com/Blockchain/getBoxOffice.php?id=", imdb));

    }
    
    function buyBet(uint _group, address _owner) onlyNotOwner(_owner)  {
        if(msg.value < valueBet) {
            if(!_owner.send(msg.value)) {
                throw;
            }
            return;
        }
        
        group[_group]++;
        bets[_owner] = _group;  
        
        // A TEJ
        nbrVoters++;
        
        if (!_owner.send(msg.value - valueBet)) {
            throw;
        } 
    }
    
    // Fermeture en dur
    function closeBet(uint _group, address _owner) onlyOwner(_owner) {
        
        closed = true;
        winnerGroup = _group;
        
        uint winOwner;
        
        
        winOwner = this.balance/100;
        reward = (this.balance - winOwner)/(this.balance/valueBet);

        if (!owner.send(winOwner)) {
            throw;
        }
    }
    
    function withdraw(address _owner) onlyClosed() onlyNotOwner(_owner) {
        if(bets[msg.sender] == winnerGroup)
        {
            if(!msg.sender.send(reward)) {
                throw;
            }
        }
        else throw;
        
    }
      
    modifier onlyNotOwner(address _owner) {
        if (_owner == owner) return;
        _;
    }
    
    modifier onlyOwner(address _owner) {
        if (_owner != owner) return;
        _;
    }
    
    modifier onlyClosed() {
        if(!closed) return;
        _;
    }  
    
    function getboxOfficeBet() returns (uint) {
        return betBoxOffice;
        
    }
    
    function getOwner() returns (address) {
        return owner;
        
    }

    function getValue() returns (uint) {
        return valueBet;
    }
    
    function getAddress() returns (address) {
        return this;
    }
    /*function __callback(bytes32 myid, string result) {
        if (msg.sender != oraclize_cbAddress()) throw;
        
        resultBoxOffice = parseInt(result); // let's save it as $ cents
        
        closed = true;
        uint group;
        
        if (resultBoxOffice < betBoxOffice/2) group=1;
        if (resultBoxOffice > betBoxOffice/2 && resultBoxOffice < 95*betBoxOffice/100) group = 2;
        if (resultBoxOffice > 95*betBoxOffice/100 && resultBoxOffice < 105*betBoxOffice/100) group = 3;
        if (resultBoxOffice > 105*betBoxOffice/100 && resultBoxOffice < 150*betBoxOffice/100) group = 4;
        if (resultBoxOffice > 150*betBoxOffice/100) group = 5;
        
        winnerGroup = group;
        
        uint winOwner;

        winOwner = this.balance/100;
        reward = (this.balance - winOwner)/(this.balance/valueBet);

    }*/
}