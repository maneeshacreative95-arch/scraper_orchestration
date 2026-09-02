const connection_mvc = require('../db/connection'); // Adjust the path according to your project structure
const connection_117 = require('../db/connection117'); 

const getDistinctFBPortals = (callback) => {
    const query = 'SELECT DISTINCT p.portalname,p.portalid FROM facebook_posts_from_pages_groups AS fb JOIN portal AS p ON p.portalid = fb.portalid order by  p.portalname asc;';
    connection_mvc.query(query, callback);
};

const getDistinctCategory = (portalid, callback) => {
    const query = 'SELECT DISTINCT CATEGORY FROM facebook_posts_from_pages_groups WHERE portalid = ?';
    connection_mvc.query(query, [portalid], callback);
};

const getDistinctPortalsFromKf_vendor = (callback) => {
    const query = `SELECT DISTINCT p.portalname,p.portalid FROM kf_vendor as ven JOIN portal as p ON p.portalid=ven.PORTAL_ID WHERE FB_PAGE_URL!='N/A' AND FB_PAGE_URL is NOT NULL  AND FB_FOLLOWER_COUNT!=0 AND VEND_CATEGRY='Hotel'`;
    connection_117.query(query, callback);
};

const getFollowerCountList = (portalid,category, callback) => {
    const query = `SELECT VEND_TITL,FB_PAGE_URL,FB_FOLLOWER_COUNT FROM kf_vendor WHERE FB_PAGE_URL!='N/A' AND FB_PAGE_URL is NOT NULL  AND FB_FOLLOWER_COUNT!=0 and PORTAL_ID =? AND VEND_CATEGRY= ? order by FB_FOLLOWER_COUNT desc Limit 20 `;
    connection_117.query(query, [portalid,category], callback);
};







module.exports = {
    getDistinctFBPortals,
    getDistinctCategory,
    getDistinctPortalsFromKf_vendor,
    getFollowerCountList
};