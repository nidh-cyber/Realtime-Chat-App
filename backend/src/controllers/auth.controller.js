import User from "../models/user.model.js"
import bcrypt from "bcryptjs"
import { generateToken } from "../lib/utils.js";
import cloudinary from "../lib/cloudinary.js"
import crypto from "crypto"

export const signup= async (req,res) => {
    // res.send("signup route");
    const {fullName,email,password}=req.body
    try {
        if(!fullName || !email || !password){
            // console.log("fullname", fullName)
           return res.status(400).json({message: "All fields are required"});
        }
        //hash password
        if(password.length<6){
            return res.status(400).json({message: "Password must be atleast 6 characters"});
        }

        const user=await User.findOne({email});

        if(user) return res.status(400).json({message: "Email already exists"});

        const salt=await bcrypt.genSalt(10);
        const hashedPassword=await bcrypt.hash(password,salt);

        const newUser=new User({
            fullName,
            email,
            password:hashedPassword
        });
        if(newUser){
            //generate jwt token here
            generateToken(newUser._id,res);
            await newUser.save();

            res.status(201).json({
                _id:newUser._id,
                fullName:newUser.fullName,
                email:newUser.email,
                profilePic:newUser.profilePic,
            });
        }
        else{
            res.status(400).json({message:"Invalid user data"});
        }
        
    } catch (error) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
};

export const login=async(req,res) => {
    // res.send("signup route");
    const {email,password}=req.body
    try {
       const user=await User.findOne({email})
       
       if(!user){
        return res.status(400).json({message:"Invalid credentials"})
       }
       const isPasswordCorrect=await bcrypt.compare(password,user.password);
       if(!isPasswordCorrect){
        return res.status(400).json({message: "Invalid credentials"});
       }

       generateToken(user._id,res)

       res.status(200).json({
        _id:user._id,
        fullName:user.fullName,
        email:user.email,
        profilePic:user.profilePic,
       })

    } catch (error) {
         console.log("Error in login controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
};

export const logout=(req,res) => {
    // res.send("signup route");
    try {
        res.cookie("jwt", "", {
            maxAge: 0,
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            domain: process.env.COOKIE_DOMAIN || undefined,
        })
        res.status(200).json({message:"Logged out successfully"})
    } catch (error) {
       console.log("Error in logout controller", error.message);
        res.status(500).json({message: "Internal Server Error"});  
    }
}; 

export const updateProfile = async(req,res) =>{
    try {
       const {profilePic}=req.body;
       const userId=req.user._id;
       
       if(!profilePic)
        return res.status(400).json({message: "Profile pic is required"});

       const uploadResponse=await cloudinary.uploader.upload(profilePic);
       const updatedUser=await User.findByIdAndUpdate(
        userId,
        {profilePic: uploadResponse.secure_url},
        {new:true}
       );

       res.status(200).json(updatedUser);


    } catch (error) {
        console.log("error in update profile: ",error);
        res.status(500).json({message:"Internal Server Error"});
    }
}; 

export const checkAuth=(req,res) => {
    try {
        // console.log("checkauth correct in try ");
       res.status(200).json(req.user); 
    } catch (error) {
        console.log("Error in checkAuth controller", error.message);
        res.status(500).json({message: "Internal server error"});
    }
};

// Forgot password - generate reset token
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(200).json({ 
                message: "If an account exists with this email, a password reset link has been sent." 
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        const resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Save reset token to user
        user.resetPasswordToken = resetPasswordToken;
        user.resetPasswordExpires = new Date(resetPasswordExpires);
        await user.save({ validateBeforeSave: false });

        // In production, you would send an email here
        // For now, we'll return the reset token in development
        // const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;
        
        // TODO: Send email with reset link
        // await sendPasswordResetEmail(user.email, resetUrl);

        // In development, log the reset token (remove in production)
        if (process.env.NODE_ENV === "development") {
            console.log("Reset Token (DEV ONLY):", resetToken);
            console.log("Reset URL:", `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`);
        }

        res.status(200).json({ 
            message: "If an account exists with this email, a password reset link has been sent.",
            // Only include in development
            ...(process.env.NODE_ENV === "development" && { resetToken, resetUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}` })
        });
    } catch (error) {
        console.log("Error in forgotPassword controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Reset password - verify token and update password
export const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and password are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        // Hash the token to compare with stored token
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user password and clear reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Password reset successfully. You can now login with your new password." });
    } catch (error) {
        console.log("Error in resetPassword controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};