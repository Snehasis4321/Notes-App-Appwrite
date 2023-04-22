const express = require('express')
const { Client, Account, ID, Databases, Query } = require('appwrite');
const app = express();
const session = require("express-session")
const { MeiliSearch } = require('meilisearch')
const ejsMate=require("ejs-mate")
const path=require("path")
const methodOverride=require("method-override")

// For MeiliSearch
const meiliclient = new MeiliSearch({ host: 'http://localhost:34567' })
meiliclient.createIndex("notes",{primaryKey:"$id"})

// For Appwrite
const client = new Client();
client
    .setEndpoint('http://localhost/v1')
    .setProject('642fcd60245b5d5cdee0');

const account = new Account(client);

const databaseId = "642fd6ed23c9e23a624d"
const collectionId = "642fd6f0c28203ea4b9f"
const database = new Databases(client)

app.engine("ejs",ejsMate)
app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))
app.use(express.static(path.join(__dirname,"public")))
app.use(express.urlencoded({extended:true}))
app.use(methodOverride("_method"))
app.use(express.json())

app.use(session({
    secret: "mysecretKey",
    resave: false,
    saveUninitialized: true
}))

// middleware function to verify the user

function verifyUser(req, res, next) {
    if (req.session.isLoggedIn)
        next();
    else {
        // res.send("not Logged in")
        res.redirect("/login")
    }
}

app.get("/", verifyUser, async (req, res) => {
    const response = await database.listDocuments(databaseId, collectionId,
        [Query.equal("createdBy", req.session.email)],
        "desc",
        "createdBy")
console.log(response)

// save in meilisearch
await meiliclient.index('notes').addDocuments(response.documents)
.then((res) => console.log(res))
        // res.send(response)
        res.render("index",{data:response.documents,email:req.session.email})

})

app.get("/register",(req,res)=>{
    res.render("register",{error:""})
})

// Create an account
app.post("/register", async (req, res) => {

    const { email, password, name } = req.body;
    account.create(
        ID.unique(),
        email,
        password,
        name
    ).then(response => {
        console.log(response);
        // res.send("Account Created")
        res.redirect("/login")
    }, error => {
        console.log(error);
        // res.send(error)
        res.render("register",{error:error.message})
       
    });
})

app.get("/login",(req,res)=>{
    res.render("login",{error:""})
})
// login the user

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    account.createEmailSession(email, password).then((response) => {
        console.log(response);
        req.session.isLoggedIn = true;
        req.session.email = email;
        // res.send("Login Successful")
        res.redirect("/")
    }, error => {
        console.log(error);
        // res.send(error)
        res.render("login",{error:error.message})
    })
})

// logout the user
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect('/login')
})

// search a note 
app.get("/search",verifyUser,async(req,res)=>{

    try{
    const data = await database.listDocuments(databaseId, collectionId,
        [Query.equal("createdBy", req.session.email)],
        "desc",
        "createdBy")
console.log(data)

const query=req.query.q;
const result=await meiliclient.index("notes").search(query);
const hits=result.hits

const matchedDocument=data.documents.filter(
    (document)=> hits.some((hit)=> hit.$id=== document.$id)
)
res.send(matchedDocument)
    }
    catch(e){
        res.send(error)
    }
})

app.get("/create",verifyUser,async(req,res)=>{
    res.render("new")
})
// create a new note
app.post("/create", async (req, res) => {
    const { title, note, createdBy } = req.body;
    const response = await database.createDocument(
        databaseId, collectionId, ID.unique(), {
        title: title,
        note: note,
        createdBy:req.session.email
    }
    ).then((response) => {
        console.log(response)
        // res.send("Document Created")
        res.redirect("/")
    }, (error) => {
        console.log(error)
        res.send(error)
    }
    )
})

app.get("/edit/:id",verifyUser,(req,res)=>{
    res.render("edit",{
        id:req.params.id,
        title:req.query.title,
        note:req.query.note
    })
})

// update the note

app.put("/edit/:id",verifyUser, async (req, res) => {
    const id = req.params.id
    const { title, note, createdBy } = req.body;
 const response= await  database.updateDocument(databaseId, collectionId, id,
        {
            title: title,
            note: note,
            createdBy: createdBy
        }
    ).then((response)=>{
        // res.send(response)
        res.redirect("/")
    },(error)=>{
        res.send(error)
    })
})

// Delete the note 
app.delete("/delete/:id",async(req,res)=>{
    const id=req.params.id;
    const response=await database.deleteDocument(databaseId,collectionId,id).then((response)=>{
        // res.send(response)
        res.redirect("/")
    },(error)=>{
        res.send(error)
    })
})

app.listen(3000, () => {
    console.log("running on 3000")
})