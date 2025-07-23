
const form = document.getElementById('form') 
const loginform = document.getElementById('loginform') 
const username = document.getElementById('username')
const email = document.getElementById('email')
const password = document.getElementById('password')
const validator = document.getElementById('validator')
const home_name = document.getElementById('home_name')  
const logout = document.getElementById('logout')
const profile_name = document.getElementById('profile_name')
const profile_email = document.getElementById('profile_email')
const profile_date = document.getElementById('profile_date')
const edit_icon = document.getElementById('edit_icon')
const edit_name = document.getElementById('edit_name')
const edit_form = document.getElementById('edit_form')
const profilepic = document.getElementById('profilepic')
const icon = document.getElementById('icon')
const locationDetail = document.getElementById('location')
const eyeIcon = document.getElementById('eyeIcon')
const path = location.pathname  

const checkAuth = async()=>{ 
    const response = await fetch('http://localhost:3000/check-auth')
    const data = await response.json()  
    if(data.err){
        location.replace('/login') 
    } 
}
 
const getUser = async() => {  
    const response = await fetch('http://localhost:3000/user') 
    const data = await response.json()
    console.log(data)
    if(data.err){
        location.replace('/login')
    }
    return data
}

const postUser = async(user)=>{
            
    const response = await fetch('http://localhost:3000/signup',{
        method:"POST",
        headers:{
            'Content-Type': 'application/json', 
        },
        body: JSON.stringify(user)
    })
    const data = await response.json()  
    return data
}

const loginUser = async(user)=>{
            
    const response = await fetch('http://localhost:3000/login',{
        method:"POST",
        headers:{
            'Content-Type': 'application/json', 
        },
        body: JSON.stringify(user)
    })
    const data = await response.json()  
    return data
}


const updateUser = async(name)=>{ 
    const response = await fetch(`http://localhost:3000/user`,{
        method:"PUT",
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({name})
    })
    const data = await response.json() 
    return data
}


const deleteUser = async()=>{  
    const response = await fetch('http://localhost:3000/user',{
        method:"DELETE", 
        credentials:'include'
    })
    const data = await response.json()  
    console.log("delete",data)
    location.replace('/login')
}

if (path === "/home"){  
    (async function(){
        const data = await getUser() 
        console.log(data) 
        home_name.innerText = data.name.charAt(0).toUpperCase()+data.name.slice(1)
        icon.innerHTML =`<button class="w-10 h-10 rounded-full bg-pink-800 flex items-center justify-center cursor-pointer">
            ${data.name.charAt(0).toUpperCase()}
        </button>`
    })()
}

if(path === "/profile.html"){ 
    checkAuth()
    let data; 
    (async function(){
        data = await getUser()  
        profile_name.innerText = data.name.charAt(0).toUpperCase()+data.name.slice(1)
        edit_name.value = data.name.charAt(0).toUpperCase()+data.name.slice(1)
        profile_email.innerText = data.email.split('@')[0]
        profile_date.innerText = data.createdAt.split('T')[0]   
        //Fetching Location by using GeoAPI
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json")
        const loc = await res.json()
        locationDetail.innerText = `${loc.city}, ${ loc.region}`
    })(),
    edit_icon.addEventListener('click',()=>{
        edit_name.classList.contains('hidden') ? (edit_name.classList.remove('hidden'), profile_name.classList.add('hidden')):( edit_name.classList.add('hidden'), profile_name.classList.remove('hidden')) 
    }) 
}

if(path === "/courses.html"){
    checkAuth() 
}


form?.addEventListener('submit',async(e)=>{ 
    e.preventDefault()
    const data =await postUser({
        name:username?.value,
        email:email.value,
        password:password.value,
    })  
    if(data.name){ 
        location.replace('/home')
        alert("Form submitted successfully!")
    }
    else if(data.msg) { 
        validator.innerText = data.msg
        validator.style.color = data.valid ? 'green':'yellow'
    }
})

loginform?.addEventListener('submit',async(e)=>{ 
    e.preventDefault()
    const data =await loginUser({ 
        email:email.value,
        password:password.value,
    })  
    if(data.name){ 
        location.replace('/home')
        alert("Form submitted successfully!")
    }
    else if(data.msg) { 
        validator.innerText = data.msg
        validator.style.color = data.valid ? 'green':'yellow'
    }
})

edit_form?.addEventListener('submit',async(e)=>{
    e.preventDefault() 
    const data = await updateUser(edit_name.value) 
    profile_name.innerText = data.name   
    location.reload()
})

logout?.addEventListener('click',async()=>{
    await deleteUser() 
    location.replace('/login')
})

eyeIcon?.addEventListener('click',()=>{
    if(eyeIcon.classList.contains('fa-eye')){
        password.setAttribute("type","password")
        eyeIcon.classList.remove('fa-eye')
        eyeIcon.classList.add('fa-eye-slash')
    }else{
        password.setAttribute("type","text")
        eyeIcon.classList.remove('fa-eye-slash')
        eyeIcon.classList.add('fa-eye')
    }
})