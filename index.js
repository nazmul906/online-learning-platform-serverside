const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const { ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("welcome to online platform");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w5hdwnt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classCollection = client.db("platformDB").collection("course");
    const userCollection = client.db("platformDB").collection("users");

    // user registration
    app.post("/users", async (req, res) => {
      const user = req.body;
      // const query = { email: user.email };
      console.log(user);
      const query = { email: user.email, role: user.role };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exist" });
      }

      const result = await userCollection.insertOne(query);
      console.log("register", result);
      res.send(result);
    });

    // get all user[only by admin]
    // app.get("/users", async (req, res) => {
    //   const result = await userCollection.find().toArray();
    //   res.send(result);
    // });

    // post class by instrucot
    app.post("/addclass", async (req, res) => {
      const item = req.body;

      const result = await classCollection.insertOne(item);
      console.log("class", result);
      res.send(result);
    });

    // get class to show in ui

    app.get("/allcourse", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // todo:enrolled
    // if enrollment field not exist in that course add it in that course and the user email
    // update the course a new field enrolled with the email, when new user enroll add that name in that enrollment filed as aray

    app.post("/enroll/:id", async (req, res) => {
      const courseId = req.params.id; // Get the course ID from the URL
      const userEmail = req.body.email; // Get the user's email from the request body

      try {
        // Check if the course with the given ID exists
        const course = await classCollection.findOne({
          _id: new ObjectId(courseId),
        });

        if (!course) {
          return res.status(404).json({ message: "Course not found" });
        }

        // Check if the course has an "enrollment" field, if not, create it as an array
        if (!course.enrollment) {
          course.enrollment = [];
        }

        // Check if the user's email is already in the "enrollment" array
        if (course.enrollment.includes(userEmail)) {
          return res
            .status(400)
            .json({ message: "User already enrolled in this course" });
        }

        // Add the user's email to the "enrollment" array
        course.enrollment.push(userEmail);

        // Update the course document with the new "enrollment" data
        const result = await classCollection.updateOne(
          { _id: new ObjectId(courseId) },
          { $set: { enrollment: course.enrollment } }
        );
        console.log("updated enrollment", result);
        if (result.modifiedCount === 1) {
          return res.status(200).json({ message: "Enrolled successfully" });
        } else {
          return res.status(500).json({ message: "Enrollment failed" });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`platform is running ${port}`);
});
