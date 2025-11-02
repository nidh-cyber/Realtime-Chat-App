import jwt from "jsonwebtoken"

export const generateToken=(userId,res) => {

    const token=jwt.sign({userId},process.env.JWT_SECRET, {
        expiresIn:"7d",
    });
    // res.cookie("jwt",token,{
    //     maxAge: 7*24*60*60*1000, //MS
    //     httpOnly:true, //prevent XSS attacks cross-site scripting attacks
    //     sameSite:"strict", //CSRF attacks cross-site request forgery attacks
    //     // secure: process.env.NODE_ENV!=="development",
    //     secure: false,
    // });
    res.cookie("jwt", token, {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  httpOnly: true,                 // blocks JS access
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // "none" required for cross-domain in production
  secure: process.env.NODE_ENV === "production", // true for HTTPS in production
  path: "/",                      // ensure it's set for all paths
  domain: process.env.COOKIE_DOMAIN || undefined, // optional: set if frontend/backend on different subdomains
});
    return token;
};