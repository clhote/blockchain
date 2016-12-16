pragma solidity ^0.4.0;

import "Bookmaker.sol";

contract BookmakerFactory {

	uint[] resultOwner;
	uint[] resultNotOwner;

	mapping(uint=>Bookmaker) bets;
	uint[] imdb_ids;
	uint[] imdb_ids_owner;
	uint[] imdb_ids_not_owner;

	mapping (uint=>Bookmaker) bets_closed;
	uint[] imdb_ids_closed; 

	function createBookmaker(uint _imdb, uint _valueBet, uint _betboxoffice) payable {
	address add = msg.sender;
	bets[_imdb]= new Bookmaker(_imdb, _valueBet, _betboxoffice, add);
	imdb_ids.push(_imdb);
	}

	function getIMDB() returns (uint[]) {

	    delete imdb_ids_owner;
	    for(uint i = 0; i<imdb_ids.length;i++)
	    {
	    	if(bets[imdb_ids[i]].getOwner()==msg.sender)
	    	{
	    		imdb_ids_owner.push(imdb_ids[i]);
	    	}
	    }
	    return imdb_ids_owner;
	}

	function getNoIMDB() returns (uint[]) {

		delete imdb_ids_not_owner;
		for(uint i=0; i<imdb_ids.length;i++)
		{
			if(bets[imdb_ids[i]].getOwner()!=msg.sender)
			{
				imdb_ids_not_owner.push(imdb_ids[i]);
			}
		}
		return imdb_ids_not_owner;
	}


	function getOwnerBet(uint _imdb) returns (address) {
        return bets[_imdb].getOwner();
        
    }

	function buyBookmakerBet(uint _group, uint _imdb){
	        bets[_imdb].buyBet(_group, msg.sender);
	}

	function withdrawBet(uint _imdb) {
		address add = 0x5c221bfdf3c1862f877bb076f616c2eddf816604;
	    bets[_imdb].withdraw(add);
	}

	function getInitialBet(uint _imdb) returns (uint) {
	    return bets[_imdb].getboxOfficeBet();
	}

	function getValueBet(uint _imdb) returns (uint) {
	    return bets[_imdb].getValue();
	}

	function getClosedBetOwner() returns (uint[]) {

		delete resultOwner;
	    for (uint i = 0; i<imdb_ids_closed.length;i++)
	    {
	        if(bets_closed[imdb_ids_closed[i]].getOwner() == msg.sender)
	        {
	            resultOwner.push(imdb_ids_closed[i]);
	        }
	    }
	    return resultOwner;
	}

	function getClosedBetNotOwner() returns (uint[]) {

		delete resultNotOwner;
	    for (uint i = 0; i<imdb_ids_closed.length;i++)
	    {
	        if(bets_closed[imdb_ids_closed[i]].getOwner() != msg.sender)
	        {
	            resultNotOwner.push(imdb_ids_closed[i]);
	        }
	    }
	    return resultNotOwner;
	}

	function closeBet(uint _group, uint _imdb) {
	    bets[_imdb].closeBet(_group, msg.sender);
	    bets_closed[_imdb] = bets[_imdb];
	    delete(bets[_imdb]);
	    
	    for (uint i = 0; i < imdb_ids.length;i++)
	    {
	        if (imdb_ids[i] == _imdb) {
	            delete(imdb_ids[i]);
	        }
	    }    
	} 
}