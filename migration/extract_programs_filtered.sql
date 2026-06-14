SET default_transaction_read_only=on;
WITH cnt AS (
  SELECT p.id, count(ap.*) FILTER (WHERE ap."deletedAt" IS NULL AND ap."isDeleted"=false) AS n
  FROM "Program" p LEFT JOIN "AssignedProgram" ap ON ap."originalProgramId"=p.id
  WHERE p."deletedAt" IS NULL GROUP BY p.id
)
SELECT json_agg(p ORDER BY p->>'name') FROM (
  SELECT json_build_object(
    'id', pr.id, 'name', pr.name, 'description', COALESCE(pr.description,''),
    'asignaciones', cnt.n,
    'weeks', (SELECT COALESCE(json_agg(w ORDER BY (w->>'order')::int),'[]'::json) FROM (
      SELECT json_build_object('order', pw."order",
        'days', (SELECT COALESCE(json_agg(d ORDER BY (d->>'order')::int),'[]'::json) FROM (
          SELECT json_build_object('order', pd."order",
            'blocks', (SELECT COALESCE(json_agg(b ORDER BY (b->>'order')::int),'[]'::json) FROM (
              SELECT json_build_object('name', pb.name,
                'trainingInstructions', COALESCE(pb."trainingInstructions",''),
                'technicalNotes', COALESCE(pb."technicalNotes",''), 'order', pb."order",
                'chronometerType', pb."chronometerType", 'restTime', pb."restTime",
                'totalRounds', pb."totalRounds", 'totalTime', pb."totalTime", 'workTime', pb."workTime",
                'exercises', (SELECT COALESCE(json_agg(json_build_object('exerciseId', pbe."exerciseId",'measurementType', pbe."measurementType")),'[]'::json)
                  FROM "ProgramBlockExercise" pbe WHERE pbe."programBlockId"=pb.id)
              ) AS b FROM "ProgramBlock" pb WHERE pb."programDayId"=pd.id) bb)
          ) AS d FROM "ProgramDay" pd WHERE pd."programWeekId"=pw.id) dd)
      ) AS w FROM "ProgramWeek" pw WHERE pw."programId"=pr.id) ww)
  ) AS p
  FROM "Program" pr JOIN cnt ON cnt.id=pr.id
  WHERE pr."deletedAt" IS NULL AND (cnt.n >= 2 OR pr.name ILIKE '%armour%')
) pp;
