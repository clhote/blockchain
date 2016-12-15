var accounts;
var account;
var imdb_id;
var toPay;

function setStatus(message) {
  var status = document.getElementById("status");
  //status.innerHTML = message;
};

function refreshBalance() {
  var meta = MetaCoin.deployed();

  meta.getBalance.call(account, {from: account}).then(function(value) {
    var balance_element = document.getElementById("balance");
    balance_element.innerHTML = value.valueOf();
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

function setId(id){
  imdb_id=id;
};

function setParameters(id){
  imdb_id=id;
  console.log("iddd= "+imdb_id);
  var meta = BookmakerFactory.deployed();
  var idInt = parseInt(imdb_id.substr(2));
  console.log("itttt= "+idInt);
  meta.getValueBet.call(idInt, {from:account}).then(function(result) {
    toPay = result.c[0];
    console.log(toPay);
    var myInput = document.getElementById("myBetAmount");
    myInput.innerHTML = "Coût du pari : "+toPay+ " wei";
  })
};


function makeBet(imdb_id, amount, bet){

    var meta = BookmakerFactory.deployed();
    var id = parseInt(imdb_id.substr(2));
  var book = meta.createBookmaker(id, amount, bet, {from:account, gas:3000000}).then(function() {
    reloadPage();
  });

 }

 /*function takeMoney(imdb_id, amount, bet){

    var meta = BookmakerFactory.deployed();
    var id = parseInt(imdb_id.substr(2));
    var book = meta.withdrawBet(id, {from:account, gas:3000000}).then(function() {
    reloadPage();
  });

 }*/

$('#done').on('click', function(){
  var amount=$("div.modal-body input:first").val();
  var bet=$("div.modal-body input:nth-child(2)").val();
  makeBet(imdb_id, amount, bet);
});

/*$('#withdrawMoney').on('click', function(){
  takeMoney(imdb_id);
});*/

function reloadPage() {
    window.location.reload(true);
}



function betOnMovie(group, id){
    var meta = BookmakerFactory.deployed();
    var id = parseInt(imdb_id.substr(2));
 // var book = meta.buyBookmakerBet(group, id, {from:account, gas:3000000}).then(function() {
   // setStatus("Ok ça marche");
  //});
console.log("group=" + group + "id="+id);
  //new(imdb_id, amount, bet, {from:account, gas:3000000}).then(function() {
//setStatus("Transaction complete!");
  //});
 }


$('#doneInProgress').on('click', function(){
  var resultBoxOffice=$("#myBet").val();
  var meta = BookmakerFactory.deployed();
  var id = parseInt(imdb_id.substr(2));
  console.log(id);
  var group;
  var book = meta.getInitialBet.call(id,{from:account}).then(function(result) {
    var betBoxOffice = result.c[0];
    console.log(result.c[0]);
    console.log(resultBoxOffice);
    if (resultBoxOffice < betBoxOffice/2) group=1;
    if (resultBoxOffice > betBoxOffice/2 && resultBoxOffice < 95*betBoxOffice/100) group = 2;
    if (resultBoxOffice > 95*betBoxOffice/100 && resultBoxOffice < 105*betBoxOffice/100) group = 3;
    if (resultBoxOffice > 105*betBoxOffice/100 && resultBoxOffice < 150*betBoxOffice/100) group = 4;
    if (resultBoxOffice > 150*betBoxOffice/100) group = 5;
    console.log(group);
    betOnMovie(group, imdb_id);
  });
  
});


$(document).ready( function(){


var now = new Date();
var nowFormat = now.toISOString().slice(0,10).replace(/-/,"-");
var next = now.setDate(now.getDate()+7);
var nextFormat = now.toISOString().slice(0,10).replace(/-/,"-");
var nextnext = now.setDate(now.getDate()+14);
var nextnextFormat = now.toISOString().slice(0,10).replace(/-/,"-");
  $("#owl-demo").owlCarousel({
    jsonPath : 'https://api.themoviedb.org/3/discover/movie?api_key=d2a74b4756416312f7c1a8b1c19ae91f&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&primary_release_date.gte='+nextFormat+'&primary_release_date.lte='+nextnextFormat+'";',
    jsonSuccess : customDataSuccess
  });


    function customDataSuccess(data){
    var content = "";
    var imdb_id;
    for(var i in data["results"]){
        if (data["results"][i].poster_path){
       var img = "http://image.tmdb.org/t/p/w500/" + data["results"][i].poster_path;
       var alt = data["results"][i].title;
        
      var urlImdb = 'https://api.themoviedb.org/3/movie/'+data["results"][i].id+'?api_key=d2a74b4756416312f7c1a8b1c19ae91f&language=en-US';
      var dataImdb = $.parseJSON(
        $.ajax({
            url: urlImdb, 
            async: false,
            dataType: 'json'
        }).responseText
    );
      if(dataImdb.imdb_id){
        content += '<img class="item" id='+dataImdb.imdb_id+' src='+img+' data-toggle="modal" data-target="#myModal" onclick="setId(\''+dataImdb.imdb_id+'\');">'
      }
        }
    }
    $("#owl-demo").append(content);
}

});

window.onload = function() {


  var meta = BookmakerFactory.deployed();
meta.getIMDB.call({from:"0x55e071201bb29f64ace87f5e44220a67fe4b1607"}).then(function(result) {
  console.log(result);
    var content2="";
  for(var i=0;i<result.length;i++){
    var dd = String(result[i].c[0]);
    console.log(dd);
    var idImdb;
    if (dd.length<7) {
      var zero = "0";
      idImdb=zero.concat(dd);
    }
    else idImdb=dd;


    var getTMDBid = 'https://api.themoviedb.org/3/find/tt'+idImdb+'?api_key=d2a74b4756416312f7c1a8b1c19ae91f&language=en-US&external_source=imdb_id';
    var dataTmdb = $.parseJSON(
      $.ajax({
        url: getTMDBid, 
        async: false,
        dataType: 'json'
      }).responseText
    );
    var TMDBid=dataTmdb["movie_results"][0].id;
    var urlGetImg = 'https://api.themoviedb.org/3/movie/'+TMDBid+'?api_key=d2a74b4756416312f7c1a8b1c19ae91f&language=en-US';
 
    var dataImg = $.parseJSON(
        $.ajax({
            url: urlGetImg, 
            async: false,
            dataType: 'json'
        }).responseText
    );
    var imgInProgress = "http://image.tmdb.org/t/p/w500/" + dataImg.poster_path;
    console.log(imgInProgress);
    content2+='<span><img class="imgInProgress" src='+imgInProgress+' data-toggle="modal" data-target="#modalInProgress" onclick="setParameters(\''+dataImg.imdb_id+'\');"></span>'
}
$("#inProgress").append(content2);
});


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

    //refreshBalance();
  });

    //console.log(BookmakerFactory.deployed());

}
