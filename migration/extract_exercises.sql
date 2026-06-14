SET default_transaction_read_only=on;
SELECT json_agg(row ORDER BY row->>'nombre') FROM (
  SELECT json_build_object(
    'id', e.id,
    'nombre', e.name,
    'explicacion', COALESCE(e.instructions, ''),
    'video', COALESCE(m.url, ''),
    'thumbnail', COALESCE(t.url, '')
  ) AS row
  FROM "Exercise" e
  LEFT JOIN "Media" m ON m."exerciseVideoId" = e.id
  LEFT JOIN "Media" t ON t."exerciseThumbnailId" = e.id
  WHERE e."deletedAt" IS NULL
) sub;
