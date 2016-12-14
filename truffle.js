module.exports = {
  build: {
    "index.html": "index.html",
    "app.js": [
      "javascripts/app.js"
    ],
    "app.css": [
      "stylesheets/app.css"
    ],
    "assets/" : "assets/",
    "owl-carousel/" : "owl-carousel/",
    "images/": "images/"
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};
