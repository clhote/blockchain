var accounts;
var account;


function setStatus(message) {
  var status = document.getElementById("status");
  //status.innerHTML = message;
};

function refreshBalance() {
  var meta = MetaCoin.deployed();

  meta.getBalance.call(account, {from: account}).then(function(value) {
    var balance_element = document.getElementById("balance");
    //balance_element.innerHTML = value.valueOf();
  }).catch(function(e) {
    console.log(e);
    setStatus("Error getting balance; see log.");
  });
};

function sendCoin() {
  var meta = MetaCoin.deployed();

  var amount = parseInt(document.getElementById("amount").value);
  var receiver = document.getElementById("receiver").value;

  setStatus("Initiating transaction... (please wait)");

  meta.sendCoin(receiver, amount, {from: account}).then(function() {
    setStatus("Transaction complete!");
    refreshBalance();
  }).catch(function(e) {
    console.log(e);
    setStatus("Error sending coin; see log.");
  });
};

$(document).ready( function(){

var now = new Date();
var nowFormat = now.toISOString().slice(0,10).replace(/-/,"-");
var next = now.setDate(now.getDate()+7);
var nextFormat = now.toISOString().slice(0,10).replace(/-/,"-");
alert(nowFormat);
alert(nextFormat);


  $("#owl-demo").owlCarousel({
    jsonPath : 'https://api.themoviedb.org/3/discover/movie?api_key=d2a74b4756416312f7c1a8b1c19ae91f&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&primary_release_date.gte='+nowFormat+'&primary_release_date.lte='+nextFormat+'";',
    jsonSuccess : customDataSuccess
  });


    function customDataSuccess(data){
    var content = "";
    for(var i in data["results"]){
        if (data["results"][i].poster_path){
       var img = "http://image.tmdb.org/t/p/w500/" + data["results"][i].poster_path;
       var alt = data["results"][i].title;
 
       content += "<img class='item' src="+img+">"
        }

    }
    $("#owl-demo").append(content);
}

})



window.onload = function() {
  web3.eth.getAccounts(function(err, accs) {
    if (err != null) {
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

  


    accounts = accs;
    account = accounts[0];

    refreshBalance();
  });
}
