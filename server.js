const express = require("express");
const mongoose = require("mongoose");
const path = require("path")
const Grid = require("gridfs-stream")
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage")
const mongoURI = process.env.mongoURI ||  require("./mongoURI")
const mongodb = require("mongodb")

const app = express();

let videoCounter = 0;

const conn = mongoose.createConnection(mongoURI);

let gfs;

conn.once("open", () => {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection("uploads");

    console.log("Mongo connected");
})

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = videoCounter
            const fileInfo = {
                filename: filename,
                bucketName: 'uploads'
            };
            resolve(fileInfo);
        });
    }
});

const upload = multer({ storage })


app.get("/", function (req, res) {
    res.status(200).send("Ok")
});

app.post('/upload', upload.single('file'), (req, res) => {
    try {
        res.redirect('/');
        videoCounter += 1;
    } catch (e) {
        res.status(500).send("server error" + e);
    }

});

app.get('/metadata/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const range = req.headers.range;

        if (!range) {
            res.status(400).send("Requires Range header");
        }

        const db = conn.db;
        const video = await db.collection("uploads.files").findOne({ filename: parseInt(id) });

        if (!video) {
            res.status(404).send("No metadata found");
        }

        const videoSize = video.length;
        const start = Number(range.replace(/\D/g, ""));
        const end = videoSize - 1;
        const contentLength = end - start + 1;
        const headers = {
            "Content-Range": `bytes ${start}-${end}/${videoSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength.toString(),
            "Content-Type": "video/mp4",
        };

        res.writeHead(206, headers);

        const bucket = new mongodb.GridFSBucket(db, { bucketName: "uploads" });
        const downloadStream = bucket.openDownloadStreamByName(video.filename, {
            start,
            end,
        });
        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).send("server error" + error);
    }

});

app.listen(process.env.PORT, function () {
    console.log("Listening on port 3000");
});

