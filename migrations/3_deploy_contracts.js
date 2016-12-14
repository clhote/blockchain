module.exports = function(deployer) {
  deployer.deploy(Bookmaker);
  deployer.autolink();
  deployer.deploy(BookmakerFactory);
};
