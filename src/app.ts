import express from "express"
import bcrypt from "bcrypt"
import { Pool, QueryResult} from "pg"
import dotenv from "dotenv"
import jwt from 'jsonwebtoken'
import bodyParser from 'body-parser';
import Joi from 'joi';



dotenv.config({ path: './config.env' });
const app = express();
const port = 3001;
app.use(bodyParser.json());

const connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

console.log("PG_CONNECTION_STRING: ", connectionString);

const pool = new Pool({
    connectionString
  });

pool.connect();

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Error connecting to the database', err.stack);
    } else {
      console.log('Connected to the database at', res.rows[0].now);
    }
  });


interface users  {
    username:string;
    password: string;
    name: string;
    email: string;
   
}

interface Student {
    name: string;
    student_id: number;
    total_marks: number;
    exam_type: string;
    
}
export const getuserresult = async (): Promise<users[]> => {
  const query = 'SELECT * FROM users';
  const result: QueryResult = await pool.query(query);
  return result.rows;
};
export const createuser = async (users: users): Promise<users> => {
  const query = 'INSERT INTO users(username, password,name, email) VALUES($1, $2, $3, $4) RETURNING *';
  const values = [users.username, users.password, users.name, users.email];
  const result: QueryResult = await pool.query(query, values);
  return result.rows[0];
};

export const createresult = async (student: Student): Promise<Student> => {
    const query = 'INSERT INTO Student (student_id,name,total_marks,exam_type) VALUES($1, $2, $3, $4) RETURNING *';
    const values = [student.student_id,student.name,student.total_marks,student.exam_type];
    const result: QueryResult = await pool.query(query, values);
    return result.rows[0];
};

const pattern = '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{5,10})';
const message = {'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'}
// Joi schema for user
const userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().pattern(new RegExp(pattern)).required().messages(message),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
});
// Joi schema for student
const studentSchema = Joi.object({
  student_id: Joi.number().required(),
  name: Joi.string().required(),
  total_marks: Joi.number().required(),
  exam_type: Joi.string().required()
});

// Register a new user
app.post('/register', async (req, res) => {
    try {
      const { error } = userSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const { username, password, name, email } = req.body;

       // Check if user with same username already exists
      const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username is already used' });
    }
    // Check if user with same email already exists
    const existingEmail = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already registered' });
    }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query('INSERT INTO users (username, password, name, email) VALUES ($1, $2, $3, $4) RETURNING *', [username, hashedPassword, name, email]);
      const user = result.rows[0];
      res.status(201).json({message: 'Register successful'});
    } catch (err) 
    {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });

  // Login as an existing user

  app.get("/users", async (req, res) => {
    try {
        const user: users[] = await getuserresult();
        res.json({ user });
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal server error");
    }
});

app.post('/user/login', async (req, res) => {
  try {
    const { error } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { username, password } = req.body;
    const Result = userSchema.validate({ email: 'example@domain.com' });
    console.log(Result); // { value: { email: 'example@domain.com' }, error: null }

    const invalidResult = userSchema.validate({ email: 'invalid_email_address' });
console.log(invalidResult.error); // Error: "email" must be a valid email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username); 

    const result = await pool.query(`SELECT * FROM users WHERE ${isEmail ? 'email' : 'username'} = $1`, [username]);
    const user = result.rows[0];
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id }, 'your-secret-key');
      res.json({token});
    } else {
      res.status(400).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

//Create Result
app.post('/user/addresult', async (req, res) => {
  try {
    const { student_id,total_marks, exam_type, name } = req.body;
   

    // Insert the result
    const result = await pool.query(
      'INSERT INTO Student (student_id, name, total_marks, exam_type) VALUES ($1, $2, $3,$4) RETURNING *',
      [student_id, name, total_marks, exam_type],
    );

    res.status(201).json({ message:'created Result' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update result record 
app.put('/results/:student_id', async (req, res) => {
  const studentId = req.params.student_id;
  const { name, total_marks,exam_type } = req.body;

  pool.query(
    'UPDATE Student SET name = $1, total_marks = $2, exam_type = $3 WHERE student_id = $4',
    [name, total_marks,exam_type, studentId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error updating student record');
      }
          return res.send({message:`Result  student id ${studentId} updated `});
        }
      );
    }
  );

// Delete result record
app.delete('/results/:student_id', async (req, res) => {
  const id = req.params.student_id;
  pool.query(
      'DELETE FROM Student WHERE student_id = $1',
      [id],
      (err: any, result: any) => {
          if (err) {
              console.error(err);
              return res.status(500).send('Error deleting result record');
          }
          if (result.rowCount === 0) {
              return res.status(404).send(`No result record found with ID: ${id}`);
          }
          return res.json({message:`Deleteing Result student_id ${id}`});
      }
  );
});


// student login
app.get("/student/login", async (req, res) => {
    try {
        const query = 'SELECT * FROM student';
        const result: QueryResult = await pool.query(query);
        const students: Student[] = result.rows;
        res.json({ students });
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal server error");
    }
});

app.get('/results/:student_id', (req, res) => {
  const studentId = req.params.student_id;
  pool.query(
      'SELECT * FROM Student WHERE student_id = $1',
      [studentId],
      (err: any, result: any) => {
          if (err) {
              console.error(err);
              return res.status(500).send('Error fetching result records');
          }
          if (result.rows.length === 0) {
              return res.status(404).send(`No result records found for student with ID: ${studentId}`);
          }
          return res.json({"message":"Result Table", data: [result.rows]});
      }
  );
});


app.listen(port, () => {
    console.log("Server running on port:", port);
});

