const TrendsModel = require('../models/TrendsModel'); // Adjust the path according to your project structure

const getportal = (req, res) => {
    TrendsModel.getDistinctFBPortals((error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: 'Failed to fetch portals' });
        } else {
            return res.json(results);
        }
    });
};

const getkfvendorPortals = (req, res) => {
    TrendsModel.getDistinctPortalsFromKf_vendor((error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: 'Failed to fetch portals' });
        } else {
            return res.json(results);
        }
    });
};


const gettrendscategory = (req, res) => {

    const portalid = req.query.portalid; // Access query parameters using req.query

    console.log("portalid",portalid)
    TrendsModel.getDistinctCategory(portalid,(error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: 'Failed to fetch Categories' });
        } else {
            return res.json(results);
        }
    });
};




const getFollowerCount = (req, res) => {

    const portalid = req.query.portalid; 
    const category = req.query.category; 

    console.log("portalid",portalid)
    TrendsModel.getFollowerCountList(portalid,category,(error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: 'Failed to fetch Categories' });
        } else {
            return res.json(results);
        }
    });
};


module.exports = {
    getportal,
    gettrendscategory,
    getkfvendorPortals,
    getFollowerCount
};