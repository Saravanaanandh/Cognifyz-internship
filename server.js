import express from 'express' 
import fs from 'fs' 
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from './model/User.js' 
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import session from 'express-session'
import passport from 'passport' 
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';  
import rateLimit from 'express-rate-limit'
import redis from 'redis'

dotenv.config()
// const data = await readFile(new URL('./data.json',import.meta.url),'utf-8')
// const localstorage = new LocalStorage('./local')
// const usersDB = {
//     users: JSON.parse(data),
//     setUsers: function (data){ this.users = data}
// }

const app = express()
const PORT = 3000 
const redisClient = redis.createClient()
await redisClient.connect()
const connectDB = async()=>{
    try{
        const conn = await mongoose.connect(process.env.DATABASE_URI)
        console.log(`MongoDB connected ${conn.connection.host}`) 
    }catch(err){
        console.log('database connection error'+err)
    }
}
connectDB()

app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: true}))
app.use(express.static('views'))
app.use(express.json())
app.use(cookieParser()) 

const apiLimiter = rateLimit({
    windowMs: 60*1000,
    max:100,
    message:{msg:"Too many requests, please try again after a minute"},
    standardHeaders:true,
    legacyHeaders:true
})
app.use(session({
  secret: 'secretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 30*24*60*60*1000}
}))
app.use(passport.initialize())
app.use(passport.session()) 

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback   : true
  },
  async function(req, accessToken, refreshToken, profile, done) { 
    const oldUser = await User.findOne({userid: profile.id})
    if(oldUser){
        req.user = oldUser
        return done(null, oldUser)
    } 
    const newUser = await User.create({
        userid:profile.id,
        name:profile.displayName,
        email:profile.emails[0].value,
        profilePic: profile.photos[0].value.replace(/=s\d+-c/, '=s512-c'),
        password:profile.id
    })
    req.user = newUser
    return done(null, newUser)
  }
));

passport.serializeUser(function(user,done){
    return done(null,user)
})
passport.deserializeUser(function(user,done){
    return done(null,user)
})

const verifyJWT = async(req, res, next)=>{
    try{
        console.log("verify JWT",req.user)
        if (req.user) return next();
        console.log("after Req.user check")
        console.log(req.cookies)
        if(!req.cookies) return res.status(401).json({err:"Unauthorized User"})
        
        const token = req.cookies?.jwt 
        if(!token) return res.status(400).json({err:"Invalid token"})
        const payload = jwt.verify(token, process.env.JWT_SECRET) 
        const userId = payload.userid  

        const authuser = await User.findById(userId)
        if(!authuser) return res.status(404).json({err:"user not found"})
        req.user = authuser;
        next();
    }catch(err){
        res.status(500).json({err})
    } 
}

app.get('/',apiLimiter,(req,res)=>{
    res.render('index') 
})

app.get('/login',apiLimiter,(req,res)=>{
    res.render('loginPage')
})

app.get('/home',apiLimiter,(req,res)=>{  
    res.render('home')
})

app.get('/auth/google',
    passport.authenticate('google',{scope: ['email','profile']})
)

app.get('/auth/google/callback',
    passport.authenticate('google',{ 
        failureRedirect:'/login'
    }),(req,res)=>{
        const token = jwt.sign({ userid: req.user.userid }, process.env.JWT_SECRET, { expiresIn: '30d' })
        res.cookie('jwt', token, {httpOnly: true, secure: false, sameSite: 'Lax', maxAge: 30*24*60*60*1000 })
        res.redirect('/home')
    }
)
  
app.get('/users',apiLimiter,verifyJWT,async(req, res)=>{ 
    try{
        const cacheUsers = await redisClient.get("users")
        if(cacheUsers) return res.json(JSON.parse(cacheUsers))

        const users = await User.find()
        if(!users) return res.status(200).json({msg:"No users are found"}) 
        await redisClient.setEx("users",3600, JSON.stringify(users))

        return res.status(200).json(users) 

    }catch(err){
        res.status(500).json({msg:err.message})
    }
})

app.get('/user',apiLimiter,verifyJWT,async(req, res)=>{
    console.log(req.user) 
    const {userid} = req.user
    console.log(userid) 
    try{
        const redisUser = await redisClient.get(userid)
        if(redisUser) return res.json(JSON.parse(redisUser))
        
        const singleUser = await User.findOne({userid})
        if(!singleUser ) return res.status(404).json({msg:"user not find"})
        console.log(singleUser)
        await redisClient.setEx(userid,3600,JSON.stringify(singleUser))
        return res.status(200).json(singleUser) 
    }catch(err){
        res.status(500).json({msg:err.message})
    }
})

app.post('/signup',apiLimiter,async(req, res)=>{   
    const {name, email, password} = req.body 
    const id = crypto.randomUUID()
    if(!name || !email || !password) return res.json({msg: "Please fill the required fields"}) 
    const duplicate = await User.findOne({email})

    if(duplicate) return res.status(409).json({valid:false,msg:"User already with that email"})
     
    try{ 
        const newUser = await User.create({...req.body,userid:id}) 
        const token = await newUser.createJWT()
        newUser.token = token 
        res.cookie('jwt',token,{httpOnly:true,maxAge:30*24*60*60*1000,secure:false, sameSite:'Lax'})  
        return res.status(201).json(newUser) 
    }catch(err){
        return res.status(500).json({msg:err.message})
    } 
}) 

app.post('/login',apiLimiter,async(req, res)=>{
    const {email,password} = req.body
    if(!email || !password) return res.status(400).json({msg:"please fill the required fields"})
    try{
        const user = await User.findOne({email})
        if(!user) return res.status(404).json({msg:"user Not found"})

        const isMatch = await user.comparePassword(password)
        if(!isMatch) return res.status(400).json({msg:"Password Incorrect"})

        const token = await user.createJWT()
        user.token = token 
        res.cookie('jwt', token, {httpOnly:true, maxAge:30*24*60*60*1000, secure:false, sameSite:'Lax'}) 
        res.status(200).json(user)
    }catch(err){
        res.status(500).json({msg:"login error"})
    }
})

app.put('/user',apiLimiter,verifyJWT,async(req,res)=>{
    console.log(req.body)
    const {userid} = req.user
    const {name} = req.body
    try{
        const updatedUser = await User.updateOne({userid},{name}) 
        const user = await User.findOne({userid})  
        return res.status(200).json(user)
    }catch(err){
        res.status(500).json({msg:"updation error"})
    }  
})

app.delete('/user',apiLimiter,verifyJWT ,async(req,res)=>{ 
    try{
        res.clearCookie('jwt',{httpOnly:true,secure:true, sameSite:'None'}) 
        res.clearCookie('connect.sid') 
        if(req.logOut){
            req.logOut()
        }
        if(req.session){
            req.session.destroy(async(err)=>{
                if(err) return res.status(500).json({msg:"session destroy error"}) 
                res.status(200).json({msg:"user logged out!"})
            })
        }else{                
            res.status(200).json({msg:"user logged out!"}) 
        } 
    }catch(err){
        res.status(500).json(err)
    }  
})

app.get('/check-auth',verifyJWT,async(req, res)=>{
    if(!req.user) return res.status(401).json({err:"Unauthorized User"})
    console.log("check auth",req.user)
    return res.status(200).json({user:req.user})
})

app.post('/contact',async(req,res)=>{
    const {name, email, phone,message} = req.body
    const info = name + '\t' + email + '\t' + phone + '\t' + message
    console.log(info)
    try{
        await fs.appendFile('./contactinfo.txt',info + '\n',(err)=>{
            if(err){ 
                console.log(err); 
                return res.send("error")
            }
            return res.send("Message sent Successfully!")
        }) 

    }catch(err){
        res.status(500).json({msg:err.message})
    }
}) 

app.use((req, res) => {
  res.status(404).render('NotFound');
});

app.listen(PORT, ()=>{
    console.log(`server running on PORT ${PORT}`) 
})
