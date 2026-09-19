import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "./db/database.js";
import { authenticate } from "./auth.js";
import type { AuthenticatedRequest, CalibrationAnswer } from "./types.js";

const advisorQuestions = [
  ["What do you want to be able to do that you cannot do well right now?", "text"],
  ["What would being really good at this look like?", "text"],
  ["Why does reaching this destination matter to you?", "text"],
  ["How would you describe your current ability?", "scale"],
  ["What can you already do confidently?", "text"],
  ["What do you struggle with most?", "text"],
  ["What have you already learned, tried, or practiced?", "text"],
  ["What feels hardest or most frustrating right now?", "text"],
  ["What do you need to learn or improve first?", "text"],
  ["What are you spending time on that may not help this goal?", "text"],
  ["What interesting areas are not necessary right now?", "text"],
  ["What constraints should the system work around?", "text"],
  ["What could you produce or demonstrate to prove improvement?", "text"],
  ["How would you personally know that you improved?", "text"],
  ["What first meaningful result do you want, and when?", "text"],
] as const;

const answerSchema = z.object({ answers: z.array(z.object({ questionOrder: z.number().int().min(1).max(15), answer: z.string().min(1).max(4000) })) });
const goalSchema = z.object({ title: z.string().min(1).max(200), description: z.string().max(4000).optional(), category: z.string().max(80).optional(), deadline: z.string().datetime().optional() });

function userId(request: AuthenticatedRequest) { return request.user.userId; }

function createGeneratedPath(user: number, assessmentId: number, goalId: number, answers: Map<number, string>) {
  const blueprint = db.prepare(`INSERT INTO advisor_blueprints (user_id, assessment_id, goal_id, destination, success_definition, motivation, baseline, strengths, gaps, bottleneck, previous_experience, constraints, cut_list, first_objective, quest_strategy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(user, assessmentId, goalId, answers.get(1), answers.get(2), answers.get(3), answers.get(4), answers.get(5), answers.get(6), answers.get(8), answers.get(7), answers.get(12), answers.get(10), answers.get(15), "Start with the bottleneck, then prove improvement through progressively harder practice.");
  const blueprintId = Number(blueprint.lastInsertRowid);
  const stage = db.prepare("INSERT INTO path_stages (blueprint_id, title, description, stage_order, status) VALUES (?, ?, ?, 1, 'active')").run(blueprintId, "First objective", answers.get(8),);
  const stageId = Number(stage.lastInsertRowid);
  const milestone = db.prepare("INSERT INTO milestones (blueprint_id, goal_id, title, description, milestone_order, status) VALUES (?, ?, ?, ?, 1, 'active')").run(blueprintId, "First proof of improvement", answers.get(13),);
  const milestoneId = Number(milestone.lastInsertRowid);
  const story = db.prepare("INSERT INTO stories (user_id, goal_id, blueprint_id, title, description) VALUES (?, ?, ?, ?, ?)").run(user, goalId, blueprintId, `The path to ${answers.get(1) || "your goal"}`, answers.get(2));
  const storyId = Number(story.lastInsertRowid);
  const chapter = db.prepare("INSERT INTO chapters (story_id, title, description, chapter_order) VALUES (?, ?, ?, 1)").run(storyId, "The first threshold", answers.get(8));
  const chapterId = Number(chapter.lastInsertRowid);
  const objective = db.prepare("INSERT INTO objectives (user_id, type, chapter_id, path_stage_id, milestone_id, title, description, difficulty, target_value, unit, xp_reward, gold_reward, status) VALUES (?, 'quest', ?, ?, ?, ?, ?, 'starter', 3, 'tasks', 250, 100, 'available')").run(user, chapterId, stageId, milestoneId, answers.get(15) || "Begin your first objective", "Build evidence toward your destination.");
  const objectiveId = Number(objective.lastInsertRowid);
  const taskTitles = ["Study or prepare for 20 minutes", "Practice the bottleneck deliberately", "Record what changed and what to do next"];
  const insertTask = db.prepare("INSERT INTO tasks (objective_id, user_id, title, description, task_type, target_value, unit, task_order, xp_reward, gold_reward) VALUES (?, ?, ?, ?, 'action', 1, 'completion', ?, ?, ?)");
  taskTitles.forEach((title, index) => insertTask.run(objectiveId, user, title, answers.get(8), index + 1, 50 + index * 25, 20 + index * 10));
  return { blueprintId, storyId, chapterId, objectiveId, milestoneId };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "lifeos-backend" }));

  app.post("/api/assessments", { preHandler: authenticate }, async (request) => {
    const user = userId(request as AuthenticatedRequest);
    const assessment = db.transaction(() => {
      const result = db.prepare("INSERT INTO assessments (user_id) VALUES (?)").run(user);
      const id = Number(result.lastInsertRowid);
      const insert = db.prepare("INSERT INTO assessment_questions (assessment_id, question_text, question_type, question_order) VALUES (?, ?, ?, ?)");
      advisorQuestions.forEach(([question, type], index) => insert.run(id, question, type, index + 1));
      return id;
    })();
    return { id: assessment, status: "in_progress", questions: db.prepare("SELECT id, question_text AS questionText, question_type AS questionType, question_order AS questionOrder FROM assessment_questions WHERE assessment_id = ? ORDER BY question_order").all(assessment) };
  });

  app.post("/api/assessments/:id/answers", { preHandler: authenticate }, async (request, reply) => {
    const user = userId(request as AuthenticatedRequest);
    const assessmentId = Number((request.params as { id: string }).id);
    const assessment = db.prepare("SELECT id FROM assessments WHERE id = ? AND user_id = ?").get(assessmentId, user);
    const parsed = answerSchema.safeParse(request.body);
    if (!assessment || !parsed.success) return reply.code(400).send({ error: "assessment or answers are invalid" });
    const save = db.prepare("INSERT INTO assessment_answers (assessment_id, question_id, answer) SELECT ?, id, ? FROM assessment_questions WHERE assessment_id = ? AND question_order = ? ON CONFLICT(assessment_id, question_id) DO UPDATE SET answer = excluded.answer");
    const transaction = db.transaction((answers: CalibrationAnswer[]) => answers.forEach((answer) => save.run(assessmentId, answer.answer, assessmentId, answer.questionOrder)));
    transaction(parsed.data.answers);
    return { saved: parsed.data.answers.length };
  });

  app.post("/api/assessments/:id/complete", { preHandler: authenticate }, async (request, reply) => {
    const user = userId(request as AuthenticatedRequest);
    const assessmentId = Number((request.params as { id: string }).id);
    const rows = db.prepare("SELECT q.question_order AS questionOrder, a.answer FROM assessment_questions q JOIN assessment_answers a ON a.question_id = q.id WHERE q.assessment_id = ? AND a.assessment_id = ? ORDER BY q.question_order").all(assessmentId, assessmentId) as { questionOrder: number; answer: string }[];
    if (rows.length !== 15) return reply.code(400).send({ error: "all 15 advisor answers are required" });
    const result = db.transaction(() => {
      const answers = new Map(rows.map((row) => [row.questionOrder, row.answer]));
      const goal = db.prepare("INSERT INTO goals (user_id, title, description, category) VALUES (?, ?, ?, 'personal')").run(user, answers.get(1), answers.get(2));
      const goalId = Number(goal.lastInsertRowid);
      db.prepare("UPDATE assessments SET goal_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(goalId, assessmentId);
      const path = createGeneratedPath(user, assessmentId, goalId, answers);
      db.prepare("INSERT INTO ai_analyses (user_id, assessment_id, goal_id, identified_problem, strengths, weaknesses, baseline_summary, recommended_strategy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(user, assessmentId, goalId, answers.get(8), answers.get(5), answers.get(6), answers.get(4), "Use short deliberate practice and measure evidence after each task.");
      return { goalId, ...path };
    })();
    return result;
  });

  app.get("/api/dashboard", { preHandler: authenticate }, async (request) => {
    const user = userId(request as AuthenticatedRequest);
    return {
      profile: db.prepare("SELECT display_name AS displayName, bio, profile_visibility AS profileVisibility FROM profiles WHERE user_id = ?").get(user),
      progress: db.prepare("SELECT current_xp AS currentXp, current_level AS currentLevel FROM player_progress WHERE user_id = ?").get(user),
      wallet: db.prepare("SELECT gold FROM player_wallet WHERE user_id = ?").get(user),
      resources: db.prepare("SELECT current_hp AS currentHp, max_hp AS maxHp, current_mp AS currentMp, max_mp AS maxMp FROM player_resources WHERE user_id = ?").get(user),
      goals: db.prepare("SELECT id, title, description, category, status, current_value AS currentValue, target_value AS targetValue, unit, deadline FROM goals WHERE user_id = ? ORDER BY created_at DESC").all(user),
      objectives: db.prepare("SELECT id, type, title, description, difficulty, target_value AS targetValue, current_value AS currentValue, unit, xp_reward AS xpReward, gold_reward AS goldReward, status, due_date AS dueDate FROM objectives WHERE user_id = ? AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC").all(user),
    };
  });

  app.get("/api/goals", { preHandler: authenticate }, async (request) => db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC").all(userId(request as AuthenticatedRequest)));
  app.post("/api/goals", { preHandler: authenticate }, async (request, reply) => {
    const parsed = goalSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "title is required" });
    const user = userId(request as AuthenticatedRequest);
    const result = db.prepare("INSERT INTO goals (user_id, title, description, category, deadline) VALUES (?, ?, ?, ?, ?)").run(user, parsed.data.title, parsed.data.description, parsed.data.category, parsed.data.deadline);
    return reply.code(201).send(db.prepare("SELECT * FROM goals WHERE id = ?").get(result.lastInsertRowid));
  });

  app.get("/api/objectives", { preHandler: authenticate }, async (request) => db.prepare("SELECT * FROM objectives WHERE user_id = ? ORDER BY created_at DESC").all(userId(request as AuthenticatedRequest)));
  app.get("/api/objectives/:id/tasks", { preHandler: authenticate }, async (request, reply) => {
    const user = userId(request as AuthenticatedRequest);
    const objectiveId = Number((request.params as { id: string }).id);
    const objective = db.prepare("SELECT id FROM objectives WHERE id = ? AND user_id = ?").get(objectiveId, user);
    if (!objective) return reply.code(404).send({ error: "objective not found" });
    return db.prepare("SELECT * FROM tasks WHERE objective_id = ? AND user_id = ? ORDER BY task_order").all(objectiveId, user);
  });

  app.post("/api/objectives/:id/tasks/:taskId/complete", { preHandler: authenticate }, async (request, reply) => {
    const user = userId(request as AuthenticatedRequest);
    const params = request.params as { id: string; taskId: string };
    const body = z.object({ actualValue: z.number().positive().optional(), notes: z.string().max(2000).optional() }).safeParse(request.body || {});
    if (!body.success) return reply.code(400).send({ error: "completion data is invalid" });
    const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND objective_id = ? AND user_id = ?").get(Number(params.taskId), Number(params.id), user) as ({ id: number; target_value: number; xp_reward: number; gold_reward: number } | undefined);
    if (!task) return reply.code(404).send({ error: "task not found" });
    const result = db.transaction(() => {
      db.prepare("UPDATE tasks SET current_value = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(body.data.actualValue || task.target_value, task.id);
      db.prepare("INSERT INTO task_completions (task_id, user_id, actual_value, notes) VALUES (?, ?, ?, ?)").run(task.id, user, body.data.actualValue || task.target_value, body.data.notes);
      db.prepare("INSERT INTO xp_transactions (user_id, amount, source_type, source_id) VALUES (?, ?, 'task', ?)").run(user, task.xp_reward, task.id);
      db.prepare("INSERT INTO gold_transactions (user_id, amount, transaction_type, source_type, source_id) VALUES (?, ?, 'earned', 'task', ?)").run(user, task.gold_reward, task.id);
      db.prepare("UPDATE player_progress SET current_xp = current_xp + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(task.xp_reward, user);
      db.prepare("UPDATE player_wallet SET gold = gold + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(task.gold_reward, user);
      const completed = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE objective_id = ? AND status = 'completed'").get(Number(params.id)) as { count: number };
      const total = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE objective_id = ?").get(Number(params.id)) as { count: number };
      if (completed.count === total.count) db.prepare("UPDATE objectives SET status = 'completed', current_value = target_value, completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(Number(params.id));
      return { completedTasks: completed.count, totalTasks: total.count };
    })();
    return { taskId: task.id, xpAwarded: task.xp_reward, goldAwarded: task.gold_reward, ...result };
  });
}
