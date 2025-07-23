import mongoose from 'mongoose'

const googleuser = mongoose.Schema({
    googleid:String,
    name:String,
    email:String
})

const googleUser = mongoose.model('googleUser',googleuser)
export default googleUser