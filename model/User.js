import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import bcryptjs from 'bcryptjs'

const userSchema = new mongoose.Schema({
    userid:{
        type:String,
        required:true
    },
    name:{
        type:String, 
        required:true
    },
    email:{
        type:String,
        match:/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        unique:true,
        required:true
    },
    password:{
        type:String,
        minLength:6 
    }, 
    profilePic:String,
    token:String
},{timestamps:true})
 
userSchema.pre('save', async function(next){
    const salt = await bcryptjs.genSalt(10)
    this.password = await bcryptjs.hash(this.password, salt) 
    next()
})  

userSchema.methods.createJWT = function(){
    return jwt.sign(
        {userid: this._id},
        process.env.JWT_SECRET,
        {expiresIn:'30d'}
    )
}

userSchema.methods.comparePassword = async function(password){
    const isCorrect = await bcryptjs.compare(password, this.password)
    return isCorrect
}

const User = mongoose.model("User",userSchema)
export default User
