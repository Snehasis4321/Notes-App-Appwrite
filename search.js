const { MeiliSearch } = require('meilisearch')
const movies = require('./movies.json')
const express=require("express")
const app=express()



const client = new MeiliSearch({ host: 'http://localhost:34567' })


app.get("/",async(req,res)=>{

   await client.index('movies').addDocuments(movies)
      .then((res) => console.log(res))
})
app.listen(4000,()=>{
    console.log("On port 4000")
})