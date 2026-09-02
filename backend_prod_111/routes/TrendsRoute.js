const express = require('express');
const router = express.Router();
const TrendsController = require('../controllers/TrendsController'); // Adjust the path according to your project structure

router.get('/portaldetails', TrendsController.getportal);

router.get('/kfportaldetails', TrendsController.getkfvendorPortals);

router.get('/categories', TrendsController.gettrendscategory);

router.get('/followercount', TrendsController.getFollowerCount);


module.exports = router;