const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());

// Firebase credentials
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceaccount.json");

// Initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PORT = process.env.PORT || 3000;
const ROUND_ID = "round1";
const CLUE_PENALTY = 2; //change 1 in final edit

// --------------------------------------------------
// QUESTIONS
// --------------------------------------------------

const QUESTIONS = [
  {
    id: "Q01",
    image: "R1_Q01.jpg",
    answer: "CHRONO_INDUS_BRONZE",
    points: 5
  },
  {
    id: "Q02",
    image: "R1_Q02.png",
    answer: "NILE",
    points: 5
  },
  {
    id: "Q03",
    image: "R1_Q03.png",
    answer: "DJED",
    points: 5
  },
  {
    id: "Q04",
    image: "R1_Q04.png",
    answer: "EUPHRATES",
    points: 5
  },
  {
    id: "Q05",
    image: "R1_Q05.png",
    answer: "ROSETTA",
    points: 5
  },
  {
    id: "Q06",
    image: "R1_Q06.png",
    answer: "HORNED_DEITY_HARAPPA",
    points: 5
  },
  {
    id: "Q07",
    image: "R1_Q07.png",
    answer: "HORUS",
    points: 5
  },
  {
    id: "Q08",
    image: "R1_Q08.png",
    answer: "ENKI",
    points: 5
  },
  {
    id: "Q09",
    image: "R1_Q09.png",
    answer: "OSIRIS",
    points: 5
  },
  {
    id: "Q10",
    image: "R1_Q10.png",
    answer: "CHOLA_VIMANA",
    points: 5
  },
  {
    id: "Q11",
    image: "R1_Q11.png",
    answer: "COSMIC_DANCE_CHOLA",
    points: 5
  },
  {
    id: "Q12",
    image: "R1_Q12.png",
    answer: "PALLAVA_DYNASTY",
    points: 5
  },
  {
    id: "Q13",
    image: "R1_Q13.png",
    answer: "MODHERA_SOLAR_EQUINOX",
    points: 5
  },
  {
    id: "Q14",
    image: "R1_Q14.png",
    answer: "VIJAYANAGARA_AXLE_77",
    points: 5
  },
  {
    id: "Q15",
    image: "R1_Q15.png",
    answer: "GARBHAGRIHA_FRAGMENT_SECURED",
    points: 5
  }
];

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function publicQuestion(question) {
  return {
    id: question.id,
    image: question.image,
    points: question.points
  };
}

// --------------------------------------------------
// HOME / HEALTH CHECK
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Chrono Explorers Round 1 backend is running."
  });
});

// --------------------------------------------------
// REGISTER TEAM
// Assign three random questions to each team
// --------------------------------------------------

app.post(
  "/registerTeam",
  asyncRoute(async (req, res) => {
    const { teamId, teamName } = req.body || {};

    // Validate input
    if (
      typeof teamId !== "string" ||
      typeof teamName !== "string" ||
      !teamId.trim() ||
      !teamName.trim()
    ) {
      throw new HttpError(
        400,
        "Team ID and Team Name are required."
      );
    }

    const cleanTeamId = teamId.trim();
    const cleanTeamName = teamName.trim();

    // Admin login
    if (
      cleanTeamId.toLowerCase() === "admin" &&
      cleanTeamName.toLowerCase() === "admin"
    ) {
      return res.json({
        success: true,
        isAdmin: true,
        teamId: "admin",
        teamName: "admin",
        assignedQuestions: []
      });
    }

    // Reserve admin ID
    if (cleanTeamId.toLowerCase() === "admin") {
      throw new HttpError(
        400,
        "Invalid Team ID or Team Name."
      );
    }

    const teamRef = db
      .collection("teams")
      .doc(cleanTeamId);

    // Register team using transaction
    const result = await db.runTransaction(
      async (transaction) => {
        const existingTeam = await transaction.get(teamRef);

        // Existing team login
        if (existingTeam.exists) {
          const teamData = existingTeam.data();

          if (teamData.teamName !== cleanTeamName) {
            throw new HttpError(
              409,
              "This Team ID belongs to another team."
            );
          }

          transaction.update(teamRef, {
            loginAt: FieldValue.serverTimestamp(),
            logoutAt: null
          });

          return {
            teamId: teamData.teamId,
            teamName: teamData.teamName,
            assignedQuestions:
              teamData.assignedQuestions || [],
            cluesUsed: teamData.cluesUsed || [] //change 4 in final edit
          };
        }

        // Shuffle questions
        const shuffled = [...QUESTIONS];

        for (
          let i = shuffled.length - 1;
          i > 0;
          i--
        ) {
          const j = Math.floor(
            Math.random() * (i + 1)
          );

          [shuffled[i], shuffled[j]] = [
            shuffled[j],
            shuffled[i]
          ];
        }

        // Assign three questions
        const assignedQuestions = shuffled.slice(0, 3);

        // Save team
        transaction.set(teamRef, {
          teamId: cleanTeamId,
          teamName: cleanTeamName,
          roundId: ROUND_ID,
          assignedQuestions,
          totalPoints: 0,
          registeredAt: FieldValue.serverTimestamp(),
          loginAt: FieldValue.serverTimestamp(),
          logoutAt: null
        });

        return {
          teamId: cleanTeamId,
          teamName: cleanTeamName,
          assignedQuestions
        };
      }
    );

    // Do not send answers to the frontend
    const publicQuestions =
      result.assignedQuestions.map(publicQuestion);

    //change 4 in final edit (start)
    const subs = (await db.collection("submissions")
      .where("teamId", "==", result.teamId).get()).docs.map(d => d.data());
    //change 4 in final edit (end)

    return res.json({
      success: true,
      teamId: result.teamId,
      teamName: result.teamName,
      assignedQuestions: publicQuestions,
      cluesUsedQuestionIds: result.cluesUsed || [], //change 4 in final edit
      solvedQuestionIds: subs.filter(s => s.isCorrect).map(s => s.questionId), //change 4 in final edit
      attemptedQuestionIds: subs.map(s => s.questionId) //change 4 in final edit
    });
  })
);

// --------------------------------------------------
// LOGOUT TEAM
// --------------------------------------------------

app.post(
  "/logoutTeam",
  asyncRoute(async (req, res) => {
    const { teamId } = req.body || {};

    if (
      typeof teamId !== "string" ||
      !teamId.trim()
    ) {
      throw new HttpError(
        400,
        "Team ID is required."
      );
    }

    const cleanTeamId = teamId.trim();

    const teamRef = db
      .collection("teams")
      .doc(cleanTeamId);

    const team = await teamRef.get();

    if (!team.exists) {
      throw new HttpError(
        404,
        "Team does not exist."
      );
    }

    await teamRef.update({
      logoutAt: FieldValue.serverTimestamp()
    });

    return res.json({
      success: true
    });
  })
);

// --------------------------------------------------
// REVEAL CLUE  //change 2 in final edit
// --------------------------------------------------

//change 2 in final edit (start of new route)
app.post("/revealClue", asyncRoute(async (req, res) => {
  const { teamId, questionId } = req.body || {};
  if (typeof teamId !== "string" || typeof questionId !== "string" ||
      !teamId.trim() || !questionId.trim()) {
    throw new HttpError(400, "Team ID and Question ID are required.");
  }
  const cleanTeamId = teamId.trim();
  const cleanQuestionId = questionId.trim();
  const teamRef = db.collection("teams").doc(cleanTeamId);
  const submissionRef = db.collection("submissions").doc(`${cleanTeamId}_${cleanQuestionId}`);

  await db.runTransaction(async (t) => {
    const team = await t.get(teamRef);
    if (!team.exists) throw new HttpError(404, "Team does not exist.");
    const assigned = (team.data().assignedQuestions || []).some(q => q.id === cleanQuestionId);
    if (!assigned) throw new HttpError(403, "This question was not assigned to your team.");
    const sub = await t.get(submissionRef);
    if (sub.exists) throw new HttpError(409, "You have already submitted this question.");
    t.update(teamRef, { cluesUsed: FieldValue.arrayUnion(cleanQuestionId) });
  });

  return res.json({ success: true });
}));
//change 2 in final edit (end of new route)

// --------------------------------------------------
// SUBMIT ANSWER
// --------------------------------------------------

app.post(
  "/submitAnswer",
  asyncRoute(async (req, res) => {
    const {
      teamId,
      questionId,
      answer,
      clueUsed //change 3 in final edit
    } = req.body || {};

    // Validate input
    if (
      typeof teamId !== "string" ||
      typeof questionId !== "string" ||
      typeof answer !== "string" ||
      !teamId.trim() ||
      !questionId.trim() ||
      !answer.trim()
    ) {
      throw new HttpError(
        400,
        "Team ID, Question ID and answer are required."
      );
    }

    const cleanTeamId = teamId.trim();
    const cleanQuestionId = questionId.trim();

    // Find question
    const question = QUESTIONS.find(
      (item) => item.id === cleanQuestionId
    );

    if (!question) {
      throw new HttpError(
        404,
        "Question does not exist."
      );
    }

    // Check answer
    const isCorrect =
      normalizeAnswer(answer) ===
      normalizeAnswer(question.answer);

    //change 3 in final edit: outer pointsAwarded removed (now calculated inside the transaction)

    const teamRef = db
      .collection("teams")
      .doc(cleanTeamId);

    const submissionRef = db
      .collection("submissions")
      .doc(
        `${cleanTeamId}_${cleanQuestionId}`
      );

    // Transaction
    const result = await db.runTransaction(
      async (transaction) => {
        const teamSnapshot =
          await transaction.get(teamRef);

        if (!teamSnapshot.exists) {
          throw new HttpError(
            404,
            "Team does not exist."
          );
        }

        const teamData = teamSnapshot.data();

        //change 3 in final edit (start)
        const usedClue =
          (teamData.cluesUsed || []).includes(cleanQuestionId) || clueUsed === true;
        const maxPoints = usedClue
          ? Math.max(0, question.points - CLUE_PENALTY)
          : question.points;
        const pointsAwarded = isCorrect ? maxPoints : 0;
        //change 3 in final edit (end)

        // Check assigned question
        const assignedQuestion =
          (teamData.assignedQuestions || []).find(
            (item) => item.id === cleanQuestionId
          );

        if (!assignedQuestion) {
          throw new HttpError(
            403,
            "This question was not assigned to your team."
          );
        }

        // Check previous submission
        const existingSubmission =
          await transaction.get(submissionRef);

        if (existingSubmission.exists) {
          throw new HttpError(
            409,
            "You have already submitted this question."
          );
        }

        // Save submission
        transaction.set(submissionRef, {
          teamId: cleanTeamId,
          teamName: teamData.teamName,
          roundId: ROUND_ID,
          questionId: cleanQuestionId,
          submittedAnswer: answer.trim(),
          isCorrect,
          pointsAwarded,
          clueUsed: usedClue, //change 3 in final edit
          maxPoints, //change 3 in final edit
          submittedAt: FieldValue.serverTimestamp()
        });

        // Update total points
        transaction.update(teamRef, {
          totalPoints:
            FieldValue.increment(pointsAwarded)
        });

        return {
          isCorrect,
          pointsAwarded,
          clueUsed: usedClue //change 3 in final edit
        };
      }
    );

    return res.json({
      success: true,
      isCorrect: result.isCorrect,
      pointsAwarded: result.pointsAwarded,
      message: result.isCorrect
        ? `Correct! You earned ${result.pointsAwarded} points.`
        : "Incorrect. You earned 0 points."
    });
  })
);

// --------------------------------------------------
// ADMIN RESULTS
// --------------------------------------------------

app.post(
  "/getAdminResults",
  asyncRoute(async (req, res) => {
    const {
      teamId,
      teamName
    } = req.body || {};

    // Admin validation
    if (
      typeof teamId !== "string" ||
      typeof teamName !== "string" ||
      teamId.trim().toLowerCase() !== "admin" ||
      teamName.trim().toLowerCase() !== "admin"
    ) {
      throw new HttpError(
        403,
        "Admin access denied."
      );
    }

    // Fetch teams and submissions
    const [
      teamsSnapshot,
      submissionsSnapshot
    ] = await Promise.all([
      db.collection("teams").get(),
      db.collection("submissions").get()
    ]);

    const submissions =
      submissionsSnapshot.docs.map(
        (doc) => doc.data()
      );

    // Prepare team results
    const teams = teamsSnapshot.docs.map((doc) => {
      const team = doc.data();

      const teamSubmissions = submissions.filter(
        (submission) =>
          submission.teamId === team.teamId
      );

      return {
        teamId: team.teamId,
        teamName: team.teamName,

        assignedQuestions:
          (team.assignedQuestions || []).map(
            publicQuestion
          ),

        submissions: teamSubmissions,

        totalPoints: team.totalPoints || 0,

        registeredAt: team.registeredAt,
        loginAt: team.loginAt,
        logoutAt: team.logoutAt
      };
    });

    return res.json({
      success: true,
      teams
    });
  })
);

// --------------------------------------------------
// 404 ROUTE
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err);

  const status = Number.isInteger(err.status)
    ? err.status
    : 500;

  res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Internal server error."
        : err.message
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Backend running on port ${PORT}`
  );
});