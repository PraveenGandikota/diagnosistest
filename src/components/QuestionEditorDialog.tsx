import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { insertQuestions, updateQuestion, type QuestionInsert } from "@/lib/quiz-db";
import { ALL_KCS, QUESTION_TYPES, type KCId, type Question, type QuestionType } from "@/lib/quiz-types";
import { toast } from "sonner";

interface QuestionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  question?: Question | null;
  seedModule?: string;
}

interface QuestionFormValues {
  quizName: string;
  kc: KCId;
  kcName: string;
  type: QuestionType;
  question: string;
  code: string;
  options: [string, string, string, string];
  correct: number;
  explanation: string;
  wrongFeedback: [string, string, string, string];
}

const DEFAULT_KC: KCId = "KC-01";
const DEFAULT_TYPE: QuestionType = "Multiple-choice (MCQ)";

function createEmptyFormValues(seedModule?: string): QuestionFormValues {
  return {
    quizName: seedModule || "",
    kc: DEFAULT_KC,
    kcName: "",
    type: DEFAULT_TYPE,
    question: "",
    code: "",
    options: ["", "", "", ""],
    correct: 0,
    explanation: "",
    wrongFeedback: ["", "", "", ""],
  };
}

function questionToFormValues(question: Question): QuestionFormValues {
  return {
    quizName: question.quizName || "",
    kc: question.kc,
    kcName: question.kcName || "",
    type: question.type,
    question: question.question,
    code: question.code || "",
    options: [
      question.options[0] || "",
      question.options[1] || "",
      question.options[2] || "",
      question.options[3] || "",
    ],
    correct: question.correct,
    explanation: question.explanation || "",
    wrongFeedback: [
      question.wrongDiagnosis[0] || "",
      question.wrongDiagnosis[1] || "",
      question.wrongDiagnosis[2] || "",
      question.wrongDiagnosis[3] || "",
    ],
  };
}

function validateForm(values: QuestionFormValues): string | null {
  if (!values.quizName.trim()) return "Module name is required.";
  if (!values.question.trim()) return "Question text is required.";
  if (values.options.some((option) => !option.trim())) return "Please fill all four options.";
  if (values.correct < 0 || values.correct > 3) return "Choose the correct answer option.";
  return null;
}

function formToInsert(values: QuestionFormValues): QuestionInsert {
  const wrongs = values.options
    .map((_, index) => (index === values.correct ? "" : values.wrongFeedback[index] || ""))
    .filter((_, index) => index !== values.correct);

  return {
    quiz_name: values.quizName.trim(),
    kc: values.kc,
    kc_name: values.kcName.trim() || values.kc,
    type: values.type,
    question: values.question.trim(),
    code: values.code,
    option_a: values.options[0].trim(),
    option_b: values.options[1].trim(),
    option_c: values.options[2].trim(),
    option_d: values.options[3].trim(),
    correct_idx: values.correct,
    explanation: values.explanation.trim(),
    wrong_a: wrongs[0] || "",
    wrong_b: wrongs[1] || "",
    wrong_c: wrongs[2] || "",
  };
}

const labels = ["A", "B", "C", "D"] as const;

export const QuestionEditorDialog = ({
  open,
  onOpenChange,
  onSaved,
  question,
  seedModule,
}: QuestionEditorDialogProps) => {
  const [values, setValues] = useState<QuestionFormValues>(() => createEmptyFormValues(seedModule));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(question ? questionToFormValues(question) : createEmptyFormValues(seedModule));
  }, [open, question, seedModule]);

  const updateOption = (index: number, nextValue: string) => {
    setValues((current) => {
      const options = [...current.options] as QuestionFormValues["options"];
      options[index] = nextValue;
      return { ...current, options };
    });
  };

  const updateWrongFeedback = (index: number, nextValue: string) => {
    setValues((current) => {
      const wrongFeedback = [...current.wrongFeedback] as QuestionFormValues["wrongFeedback"];
      wrongFeedback[index] = nextValue;
      return { ...current, wrongFeedback };
    });
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateForm(values);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const payload = formToInsert(values);
    const result = question
      ? await updateQuestion(question.id, payload)
      : await insertQuestions([payload]);
    setSaving(false);

    if (result.error) {
      toast.error(question ? `Update failed: ${result.error.message}` : `Add failed: ${result.error.message}`);
      return;
    }

    toast.success(question ? "Question updated" : "Question added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? "Edit question" : "Add one question"}</DialogTitle>
          <DialogDescription>
            Update the module, prompt, answers, and feedback for this question.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSave}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Module">
              <Input
                value={values.quizName}
                onChange={(event) => setValues((current) => ({ ...current, quizName: event.target.value }))}
                placeholder="Python Basics - Module 1"
              />
            </Field>

            <Field label="Topic name">
              <Input
                value={values.kcName}
                onChange={(event) => setValues((current) => ({ ...current, kcName: event.target.value }))}
                placeholder="Loops and iteration"
              />
            </Field>

            <Field label="KC code">
              <select
                value={values.kc}
                onChange={(event) => setValues((current) => ({ ...current, kc: event.target.value as KCId }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {ALL_KCS.map((kc) => (
                  <option key={kc} value={kc}>
                    {kc}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Question type">
              <select
                value={values.type}
                onChange={(event) => setValues((current) => ({ ...current, type: event.target.value as QuestionType }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Question text">
            <Textarea
              value={values.question}
              onChange={(event) => setValues((current) => ({ ...current, question: event.target.value }))}
              placeholder="Write the question prompt here"
              className="min-h-[120px]"
            />
          </Field>

          <Field label="Code block (optional)">
            <Textarea
              value={values.code}
              onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
              placeholder="Optional code snippet shown with the question"
              className="min-h-[120px] font-mono"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            {labels.map((label, index) => (
              <div key={label} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Option {label}</div>
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="radio"
                      name="correct-option"
                      checked={values.correct === index}
                      onChange={() => setValues((current) => ({ ...current, correct: index }))}
                    />
                    Correct answer
                  </label>
                </div>

                <div className="space-y-3">
                  <Input
                    value={values.options[index]}
                    onChange={(event) => updateOption(index, event.target.value)}
                    placeholder={`Answer choice ${label}`}
                  />
                  <Textarea
                    value={values.wrongFeedback[index]}
                    onChange={(event) => updateWrongFeedback(index, event.target.value)}
                    disabled={values.correct === index}
                    placeholder={values.correct === index ? "Not used for the correct answer" : `Feedback if ${label} is selected`}
                    className="min-h-[96px]"
                  />
                </div>
              </div>
            ))}
          </div>

          <Field label="Explanation">
            <Textarea
              value={values.explanation}
              onChange={(event) => setValues((current) => ({ ...current, explanation: event.target.value }))}
              placeholder="Explain why the correct answer is right"
              className="min-h-[110px]"
            />
          </Field>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (question ? "Saving..." : "Adding...") : (question ? "Save changes" : "Add question")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-2">
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
  </label>
);
