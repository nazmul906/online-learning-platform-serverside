const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const { ObjectId } = require("mongodb");
const multer = require("multer");

const jwt = require("jsonwebtoken");

// Create a storage engine for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/"); // Define the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Define the file name for uploaded files
  },
});

const upload = multer({ storage: storage });
// middleware
app.use(cors());
app.use(express.json());

// verifyjwt

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unathorized token" });
  }

  const token = authorization.split(" ")[1];

  // now verify
  jwt.verify(token, process.env.SecretAccessToken, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unathorized token" });
    }
    req.decoded = decoded;
    next();
  });
};

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

    // jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;

      const jwtToken = jwt.sign(user, process.env.SecretAccessToken, {
        expiresIn: "8hr",
      });
      res.send({ jwtToken });
    });
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
        /*  console.log("updated enrollment", result);*/
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

    // add to favourite by user(with their email)
    // Toggle course as favorite for a user
    app.post("/favorite/:id", async (req, res) => {
      const courseId = req.params.id;
      const userEmail = req.body.email;

      try {
        // Check if the course with the given ID exists
        const course = await classCollection.findOne({
          _id: new ObjectId(courseId),
        });

        if (!course) {
          return res.status(404).json({ message: "Course not found" });
        }

        // Check if the course has a "favorites" field, if not, create it as an array
        if (!course.favorites) {
          course.favorites = [];
        }

        // it is for updating the favourite option to unfavouite by clicking
        // Check if the user's email is already in the "favorites" array

        const index = course.favorites.indexOf(userEmail);
        if (index === -1) {
          // User is not in favorites, so add them
          course.favorites.push(userEmail);
        } else {
          // User is in favorites, so remove them (toggle favorite)
          course.favorites.splice(index, 1);
          return res.status(200).json({ message: "Favorite status removed" });
        }

        // Update the course document with the new "favorites" data
        const result = await classCollection.updateOne(
          { _id: new ObjectId(courseId) },
          { $set: { favorites: course.favorites } }
        );

        if (result.modifiedCount === 1) {
          // Favorite status updated successfully
          return res.status(200).json({ message: "Favorite status updated" });
        } else {
          return res
            .status(500)
            .json({ message: "Failed to update favorite status" });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // get course by an instructor

    app.get("/courses/:instructorEmail", async (req, res) => {
      const instructorEmail = req.params.instructorEmail;

      try {
        // Use your MongoDB client and collection to query courses by instructor email
        const courses = await classCollection
          .find({ instructorEmail })
          .toArray();

        if (courses.length === 0) {
          return res
            .status(404)
            .json({ message: "No courses found for this instructor" });
        }

        // Send the courses as a JSON response
        res.json(courses);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // route for uploading content by instructor
    app.post("/uploadVideo/:id", upload.single("video"), async (req, res) => {
      const courseId = req.params.id; // Get the course ID from the URL
      const videoFile = req.file; // Get the uploaded video file
      const content = videoFile.filename; // Store the filename in the content field

      try {
        // Check if the course with the given ID exists
        const course = await classCollection.findOne({
          _id: new ObjectId(courseId),
        });

        if (!course) {
          return res.status(404).json({ message: "Course not found" });
        }

        // Update the course document with the new content (video)
        const result = await classCollection.updateOne(
          { _id: new ObjectId(courseId) },
          { $set: { content: content } }
        );

        if (result.modifiedCount === 1) {
          // Video uploaded and course updated successfully
          return res
            .status(200)
            .json({ success: true, message: "Video uploaded successfully" });
        } else {
          return res
            .status(500)
            .json({ success: false, message: "Failed to update course" });
        }
      } catch (error) {
        console.error(error);
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // verify instructor for useinstructor hooks
    app.get("/users/instructor/:email", verifyJwt, async (req, res) => {
      const userEmail = req.params.email;
      // console.log("userEmail", userEmail);
      if (userEmail !== req.decoded.email) {
        res.send({ instructor: false });
      }
      const query = { email: userEmail };
      const user = await userCollection.findOne(query);
      // console.log(user);
      const result = { instructor: user?.role === "instructor" };
      // response is {instructor:true}
      res.send(result);
    });

    // user role is checked

    app.get("/users/user/:email", verifyJwt, async (req, res) => {
      const userEmail = req.params.email;

      if (userEmail !== req.decoded.email) {
        res.send({ user: false });
      }

      const query = { email: userEmail };
      const user = await userCollection.findOne(query);

      const result = { user: user?.role === "user" };
      res.send(result);
    });

    // get course by user enrolled

    // Update your Express backend with this route
    app.get("/enrolledcourses/:userEmail", async (req, res) => {
      const userEmail = req.params.userEmail;

      try {
        const enrolledCourses = await classCollection
          .find({ enrollment: userEmail })
          .toArray();
        res.json(enrolledCourses);
      } catch (error) {
        console.error("Error fetching enrolled courses:", error);
        res.status(500).json({ message: "Internal server error" });
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
