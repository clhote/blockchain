pragma solidity ^0.4.0;

import "Bookmaker.sol";

contract BookmakerFactory {


mapping(uint=>Bookmaker) bets;
uint[] imdb_ids;

function createBookmaker(uint _imdb, uint _valueBet, uint _betboxoffice) {
//bookmakers.push(new Bookmaker(_imdb, _valueBet, _betboxoffice, msg.sender));
bets[_imdb]= new Bookmaker(_imdb, _valueBet, _betboxoffice, msg.sender);
imdb_ids.push(_imdb);
}

function getIMDB() returns (uint[]) {
    return imdb_ids;
}

function buyBookmakerBet(uint _group, uint _imdb) payable {
        bets[_imdb].buyBet(_group, msg.sender);
}

function withdraw(uint _imdb, address _owner) {
    bets[_imdb].withdraw(_owner);
}

function getInitialBet(uint _imdb) returns (uint){
    return bets[_imdb].getboxOfficeBet();
}


function closeBet(uint _group, uint _imdb) {
    
    bets[_imdb].closeBet(_group, msg.sender);
    
    delete(bets[_imdb]);
    
    for (uint i = 0; i < imdb_ids.length;i++)
{
    if (imdb_ids[i] == _imdb) delete(imdb_ids[i]);
}    
}
}