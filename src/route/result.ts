import { Request, Response } from 'express';
import Joi from 'joi';
import Result from '../model/resultmodel';
import '../database'

const studentSchema = Joi.object({
  student_id: Joi.number().required(),
  subject: Joi.string().required(),
  marks: Joi.number().integer().min(0).max(100).required()
});

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}


const addResult = async (req: Request, res: Response) => {
  try {
    const { error ,value } = studentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const user_role = req.user.role;

    if (user_role !== 'admin') {
      return res.status(403).json({ message: 'Access forbidden' });
    }
    
    const result = await Result.create({
      student_id: req.body.student_id,
      subject: req.body.subject,
      marks: req.body.marks
    });

    res.json({ message: `Result added successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
}



const updateResult = async (req: Request, res: Response) => {
  const { error } = studentSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const studentId = req.params.student_id;
  const { subject, marks } = req.body;

  try {
    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Access forbidden' });
    }

    const result = await Result.update({ subject, marks }, { where: { student_id: studentId } });
    if (result[0] === 0) {
      return res.status(404).json({ message: `Result for student id ${studentId} not found` });
    }

    return res.json({ message: `Result for student id ${studentId} updated` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error updating student record' });
  }
}

const getResult = async (req: Request, res: Response) => {
  try {
    const { error } = studentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { role } = req.user;
    if (role !== 'admin' && role !== 'student') {
      return res.status(401).json({ error: 'Access forbidden' });
    }
    const student_id = req.user.id;

    // pagination
    const { limit = 20, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows: students } = await Result.findAndCountAll({
      limit: Number(limit),
      offset,
    });

    res.json({ students, totalCount: count, currentPage: page });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
};



export { addResult, updateResult, getResult };



