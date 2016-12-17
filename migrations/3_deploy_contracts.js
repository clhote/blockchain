module.exports = function(deployer) {
  deployer.deploy(Bookmaker, {gas: 3500000});
  deployer.autolink();
  deployer.deploy(BookmakerFactory, {gas: 3500000});
};
