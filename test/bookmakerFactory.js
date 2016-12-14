contract('BookmakerFactory', function(accounts) {
  it("first try", function() {
    var meta = BookmakerFactory.deployed();
      var book = meta.createBookmaker(3640424, 10, 10, {from:accounts[0], gas:3000000}).then(function() {
        console.log("ok uhsuhdu");
  });

    return meta.getIMDB.call().then(function(ids) {
console.log(ids);
    });
    });
  });    

  