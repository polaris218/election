var express = require('express');
var router = express.Router();

let { upcoming, home } = require("../controllers");

/* GET home page. */
router.get('/', home);

/* Get Vote Data*/
router.get("/upcoming", upcoming);

module.exports = router;
