-- Defaults depend on category kind. Keep explicit incompatible methods invalid.
ALTER TABLE "JudgingCategory" ALTER COLUMN "method" DROP DEFAULT;
CREATE FUNCTION set_category_method_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."method" IS NULL THEN
    NEW."method" := CASE WHEN NEW."kind" = 'CHALLENGE'
      THEN 'RATING_SCALE'::"JudgingMethod" ELSE 'RELATIVE'::"JudgingMethod" END;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER category_method_default BEFORE INSERT ON "JudgingCategory"
FOR EACH ROW EXECUTE FUNCTION set_category_method_default();
ALTER TABLE "JudgingCategory" ADD CONSTRAINT category_method_kind CHECK (
  ("kind" = 'CHALLENGE' AND "method" IN ('RATING_SCALE', 'RUBRIC')) OR
  ("kind" IN ('OVERALL', 'TRACK') AND "method" IN ('RELATIVE', 'RUBRIC'))
);

CREATE FUNCTION protect_overall_category() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."kind" = 'OVERALL' THEN
    RAISE EXCEPTION 'The Overall category cannot be deleted or converted' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_overall_delete BEFORE DELETE ON "JudgingCategory"
FOR EACH ROW EXECUTE FUNCTION protect_overall_category();
CREATE TRIGGER protect_overall_kind BEFORE UPDATE OF "kind" ON "JudgingCategory"
FOR EACH ROW WHEN (OLD."kind" IS DISTINCT FROM NEW."kind")
EXECUTE FUNCTION protect_overall_category();
