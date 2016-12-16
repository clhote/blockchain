module.exports = function(deployer) {
  deployer.deploy(Bookmaker, {gas: 3000000});
  deployer.autolink();
  deployer.deploy(BookmakerFactory, {gas: 3000000});
};
