import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import {
  ExamState,
  TechnologyLevel,
  GuardianResponse,
  CheckResponse,
  LessonResponse,
  SummaryResponse,
} from "../types";

type ExamPhase = "welcome" | "question" | "checked" | "lesson" | "summary";

const API_TIMEOUT = 30000; // 30 sekund

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = API_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function handleApiError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return "Przekroczono limit czasu oczekiwania. Sprawdź czy backend działa na porcie 8000.";
    }
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      return "Nie można połączyć się z serwerem. Sprawdź czy backend działa.";
    }
    return err.message;
  }
  return "Nieznany błąd";
}

const STORAGE_KEYS = {
  examState: 'examState',
  examPhase: 'examPhase',
  userAnswer: 'userAnswer',
  examConfig: 'examConfig',
};

export default function Egzaminator() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<ExamPhase>("welcome");
  const [examState, setExamState] = useState<ExamState | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [copiedLesson, setCopiedLesson] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const initializedRef = useRef(false);

  // Zapisywanie stanu do sessionStorage
  const saveExamState = (state: ExamState | null) => {
    if (state) {
      sessionStorage.setItem(STORAGE_KEYS.examState, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.examState);
    }
  };

  const savePhase = (phase: ExamPhase) => {
    sessionStorage.setItem(STORAGE_KEYS.examPhase, phase);
  };

  const saveUserAnswer = (answer: string) => {
    sessionStorage.setItem(STORAGE_KEYS.userAnswer, answer);
  };

  // Przywracanie stanu z sessionStorage
  const restoreExamState = (): ExamState | null => {
    const saved = sessionStorage.getItem(STORAGE_KEYS.examState);
    if (!saved) return null;
    
    try {
      const state = JSON.parse(saved);
      // Walidacja: czy lesson ma nowy format (obiekt) czy stary (string)
      if (state.questions) {
        state.questions = state.questions.map((q: any) => {
          // Jeśli lesson jest stringiem (stary format), usuń go
          if (q.lesson && typeof q.lesson === 'string') {
            return { ...q, lesson: null };
          }
          return q;
        });
      }
      return state;
    } catch {
      return null;
    }
  };

  const restorePhase = (): ExamPhase => {
    const saved = sessionStorage.getItem(STORAGE_KEYS.examPhase);
    return (saved as ExamPhase) || "welcome";
  };

  const restoreUserAnswer = (): string => {
    return sessionStorage.getItem(STORAGE_KEYS.userAnswer) || "";
  };

  // Inicjalizacja - sprawdzamy czy jest zapisany stan egzaminu
  useEffect(() => {
    // Zabezpieczenie przed wielokrotnym uruchomieniem
    if (initializedRef.current) return;
    initializedRef.current = true;

    const savedExamState = restoreExamState();
    
    if (savedExamState) {
      // Przywracamy zapisany stan egzaminu
      setExamState(savedExamState);
      setPhase(restorePhase());
      setUserAnswer(restoreUserAnswer());
      return;
    }

    // Jeśli nie ma zapisanego stanu, sprawdzamy czy jest konfiguracja dla nowego egzaminu
    const configStr = sessionStorage.getItem(STORAGE_KEYS.examConfig);
    if (!configStr) {
      setError("Brak konfiguracji egzaminu. Przekierowuję do strony głównej...");
      const timeoutId = setTimeout(() => {
        setLocation("/");
      }, 2000);
      return () => clearTimeout(timeoutId);
    }

    try {
      const config = JSON.parse(configStr);
      sessionStorage.removeItem(STORAGE_KEYS.examConfig);
      initializeExam(config.technologies, config.questionCount);
    } catch (err) {
      setError("Błąd parsowania konfiguracji egzaminu. Przekierowuję do strony głównej...");
      const timeoutId = setTimeout(() => {
        setLocation("/");
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Zapisywanie stanu przy każdej zmianie
  useEffect(() => {
    if (examState) {
      saveExamState(examState);
    }
  }, [examState]);

  useEffect(() => {
    if (phase !== "welcome") {
      savePhase(phase);
    }
  }, [phase]);

  useEffect(() => {
    saveUserAnswer(userAnswer);
  }, [userAnswer]);

  const initializeExam = async (technologies: TechnologyLevel[], questionCount: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithTimeout("/api/exam/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technologies, question_count: questionCount }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Błąd: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error("Nieprawidłowy format odpowiedzi z API");
      }

      const newState: ExamState = {
        questions: data.questions,
        currentQuestionIndex: 0,
        metadata: {
          timestamp: new Date().toISOString(),
          totalQuestions: data.questions.length,
        },
      };
      setExamState(newState);
      saveExamState(newState);
      setPhase("question");
      savePhase("question");
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!examState || !userAnswer.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const currentQuestion = examState.questions[examState.currentQuestionIndex];
      
      const guardianResponse = await fetchWithTimeout("/api/exam/guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: currentQuestion.question,
          answer: userAnswer 
        }),
      });

      const guardianData: GuardianResponse = await guardianResponse.json();

      if (!guardianData.valid) {
        setError(guardianData.explanation || "Odpowiedź niezgodna z zasadami");
        setLoading(false);
        return;
      }
      const checkResponse = await fetchWithTimeout("/api/exam/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.question,
          answer: userAnswer,
        }),
      });

      const checkData: CheckResponse = await checkResponse.json();

      const updatedQuestions = [...examState.questions];
      updatedQuestions[examState.currentQuestionIndex] = {
        ...currentQuestion,
        answer: userAnswer,
        scoring: checkData.scoring,
        comment: checkData.comment,
      };

      const newState = { ...examState, questions: updatedQuestions };
      setExamState(newState);
      saveExamState(newState);
      setPhase("checked");
      savePhase("checked");
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadLesson = async () => {
    if (!examState) return;

    setLoading(true);
    setError(null);

    try {
      const currentQuestion = examState.questions[examState.currentQuestionIndex];
      const response = await fetchWithTimeout("/api/exam/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.question,
          answer: currentQuestion.answer,
          scoring: currentQuestion.scoring,
          comment: currentQuestion.comment,
        }),
      });

      const data: LessonResponse = await response.json();

      const updatedQuestions = [...examState.questions];
      updatedQuestions[examState.currentQuestionIndex].lesson = data;

      const newState = { ...examState, questions: updatedQuestions };
      setExamState(newState);
      saveExamState(newState);
      setPhase("lesson");
      savePhase("lesson");
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = () => {
    if (!examState) return;

    if (examState.currentQuestionIndex < examState.questions.length - 1) {
      const newState = {
        ...examState,
        currentQuestionIndex: examState.currentQuestionIndex + 1,
      };
      setExamState(newState);
      saveExamState(newState);
      setUserAnswer("");
      saveUserAnswer("");
      setError(null);
      setPhase("question");
      savePhase("question");
    } else {
      finishExam();
    }
  };

  const copyToClipboard = async (text: string, setCopied: (value: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Błąd kopiowania do schowka:", err);
      setError("Nie udało się skopiować do schowka");
    }
  };

  const finishExam = async () => {
    if (!examState || isGeneratingSummary) return;

    setIsGeneratingSummary(true);
    setError(null);

    try {
      const questionsData = examState.questions.map((q) => ({
        question: q.question,
        comment: q.comment || "",
        scoring: q.scoring || 0,
      }));

      const response = await fetchWithTimeout("/api/exam/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsData }),
      });

      const data: SummaryResponse = await response.json();
      setSummary(data);
      setPhase("summary");
      savePhase("summary");
      // Czyszczenie stanu po zakończeniu egzaminu
      sessionStorage.removeItem(STORAGE_KEYS.examState);
      sessionStorage.removeItem(STORAGE_KEYS.examPhase);
      sessionStorage.removeItem(STORAGE_KEYS.userAnswer);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Loading screen
  if (!examState && phase === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center space-y-4">
            {loading ? (
              <>
                <div className="w-12 h-12 border-4 border-sky-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-600">Przygotowuję egzamin...</p>
              </>
            ) : error ? (
              <>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-semibold mb-2">Błąd podczas inicjalizacji</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
                <button
                  onClick={() => {
                    // Czyszczenie stanu przed powrotem
                    sessionStorage.removeItem(STORAGE_KEYS.examState);
                    sessionStorage.removeItem(STORAGE_KEYS.examPhase);
                    sessionStorage.removeItem(STORAGE_KEYS.userAnswer);
                    sessionStorage.removeItem(STORAGE_KEYS.examConfig);
                    setLocation("/");
                  }}
                  className="mt-4 px-6 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
                >
                  Powrót do strony głównej
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 border-4 border-sky-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-600">Przygotowuję egzamin...</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!examState) return null;

  const currentQuestion = examState.questions[examState.currentQuestionIndex];
  const progress = ((examState.currentQuestionIndex + 1) / examState.metadata.totalQuestions) * 100;
  const isLastQuestion = examState.currentQuestionIndex === examState.questions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Pytanie {examState.currentQuestionIndex + 1} z {examState.metadata.totalQuestions}</span>
            <span>{currentQuestion.technology} - Poziom {currentQuestion.level}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-sky-800 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Question phase */}
          {phase === "question" && (
            <>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-900">{currentQuestion.question}</h2>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Wpisz swoją odpowiedź..."
                  className="w-full min-h-32 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  disabled={loading}
                />
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}
              </div>
              <button
                onClick={submitAnswer}
                disabled={loading || !userAnswer.trim()}
                className="w-full py-3 bg-sky-800 text-white rounded-lg font-semibold hover:bg-sky-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                Sprawdź odpowiedź
              </button>
              <button
                  onClick={() => {
                    // Czyszczenie stanu przed powrotem
                    sessionStorage.removeItem(STORAGE_KEYS.examState);
                    sessionStorage.removeItem(STORAGE_KEYS.examPhase);
                    sessionStorage.removeItem(STORAGE_KEYS.userAnswer);
                    sessionStorage.removeItem(STORAGE_KEYS.examConfig);
                    setLocation("/");
                  }}
                  className="w-full py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  Powrót do strony głównej
              </button>
            </>
          )}

          {/* Checked phase */}
          {phase === "checked" && (
            <>
              <div className="space-y-4">
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-16 h-16 bg-sky-800 text-white rounded-full">
                      <span className="text-2xl font-bold">{currentQuestion.scoring}</span>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Twoja ocena</p>
                      <p className="text-2xl font-bold text-blue-900">{currentQuestion.scoring}/10</p>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none prose-blue
                    prose-headings:text-blue-900 prose-headings:font-semibold prose-headings:text-base
                    prose-strong:text-blue-900 prose-strong:font-semibold
                    prose-code:text-blue-800 prose-code:bg-blue-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                    prose-ul:text-blue-900 prose-li:text-blue-900 prose-ul:my-2 prose-li:my-0
                    prose-p:text-blue-900 prose-p:leading-relaxed prose-p:my-2">
                    <ReactMarkdown>{currentQuestion.comment || ""}</ReactMarkdown>
                  </div>
                </div>
              </div>
              
              {isGeneratingSummary ? (
                // Spinner podczas generowania podsumowania
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-12 h-12 border-4 border-sky-800 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-600 font-medium">Trwa generowanie podsumowania egzaminu...</p>
                </div>
              ) : (
                // Przyciski akcji
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      onClick={loadLesson}
                      disabled={loading || isGeneratingSummary}
                      className="flex-1 py-3 bg-teal-700 text-white rounded-lg font-semibold hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                      Pokaż lekcję
                    </button>
                    <button
                      onClick={nextQuestion}
                      disabled={loading || isGeneratingSummary}
                      className="flex-1 py-3 bg-sky-800 text-white rounded-lg font-semibold hover:bg-sky-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isLastQuestion ? "Zakończ egzamin" : "Następne pytanie"}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      // Czyszczenie stanu przed powrotem
                      sessionStorage.removeItem(STORAGE_KEYS.examState);
                      sessionStorage.removeItem(STORAGE_KEYS.examPhase);
                      sessionStorage.removeItem(STORAGE_KEYS.userAnswer);
                      sessionStorage.removeItem(STORAGE_KEYS.examConfig);
                      setLocation("/");
                    }}
                    className="w-full py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Powrót do strony głównej
                  </button>
                </div>
              )}
            </>
          )}

          {/* Lesson phase */}
          {phase === "lesson" && currentQuestion.lesson && typeof currentQuestion.lesson === 'object' && 'explanation' in currentQuestion.lesson && (
            <>
              <div className="space-y-6">
                {/* Nagłówek lekcji */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-3xl">📚</span>
                    <h2 className="text-2xl font-bold text-green-900">Lekcja</h2>
                  </div>
                  <p className="text-green-700 font-medium">{currentQuestion.question}</p>
                </div>

                <div className="space-y-4">
                  {/* Wyjaśnienie */}
                  <div className="p-5 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-base font-bold text-green-900 uppercase tracking-wide">Wyjaśnienie</h3>
                      <button
                        onClick={() => {
                          if (!currentQuestion.lesson) return;
                          const lessonMd = `# Lekcja - ${currentQuestion.question}\n\n## Wyjaśnienie\n\n${currentQuestion.lesson.explanation}\n\n## Kluczowe koncepcje\n\n${currentQuestion.lesson.key_concepts.map(c => `- ${c}`).join('\n')}\n\n## Przykład\n\n${currentQuestion.lesson.example}\n\n## Podsumowanie\n\n${currentQuestion.lesson.summary}`;
                          copyToClipboard(lessonMd, setCopiedLesson);
                        }}
                        className="px-3 py-1.5 text-sm bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors font-medium"
                      >
                        {copiedLesson ? "✓ Skopiowano!" : "Kopiuj .md"}
                      </button>
                    </div>
                    <div className="prose prose-sm max-w-none
                      prose-strong:text-green-900 prose-strong:font-bold
                      prose-code:text-green-800 prose-code:bg-green-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                      prose-p:text-green-900 prose-p:leading-relaxed prose-p:my-0">
                      <ReactMarkdown>{currentQuestion.lesson.explanation}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Kluczowe koncepcje */}
                  {currentQuestion.lesson.key_concepts && currentQuestion.lesson.key_concepts.length > 0 && (
                    <div className="p-5 bg-green-50 border border-green-200 rounded-lg">
                      <h3 className="text-base font-bold text-green-900 uppercase tracking-wide mb-3">Kluczowe koncepcje</h3>
                      <ul className="space-y-2">
                        {currentQuestion.lesson.key_concepts.map((concept, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-green-600 mt-1">•</span>
                            <div className="flex-1 prose prose-sm max-w-none
                              prose-strong:text-green-900 prose-strong:font-bold
                              prose-code:text-green-800 prose-code:bg-green-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                              prose-p:text-green-900 prose-p:my-0">
                              <ReactMarkdown>{concept}</ReactMarkdown>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Przykład */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg">
                    <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-3">Przykład</h3>
                    <div className="prose prose-sm max-w-none
                      prose-strong:text-slate-900 prose-strong:font-bold
                      prose-code:text-slate-800 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                      prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-4 prose-pre:my-2
                      prose-p:text-slate-900 prose-p:leading-relaxed prose-p:my-2">
                      <ReactMarkdown>{currentQuestion.lesson.example}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Podsumowanie */}
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-base font-bold text-blue-900 uppercase tracking-wide mb-3">Podsumowanie</h3>
                    <div className="prose prose-sm max-w-none
                      prose-strong:text-blue-900 prose-strong:font-bold
                      prose-code:text-blue-800 prose-code:bg-blue-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                      prose-p:text-blue-900 prose-p:leading-relaxed prose-p:my-0">
                      <ReactMarkdown>{currentQuestion.lesson.summary}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
              
              {isGeneratingSummary ? (
                // Spinner podczas generowania podsumowania
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-12 h-12 border-4 border-sky-800 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-600 font-medium">Trwa generowanie podsumowania egzaminu...</p>
                </div>
              ) : (
                <button
                  onClick={nextQuestion}
                  disabled={isGeneratingSummary}
                  className="w-full py-3 bg-sky-800 text-white rounded-lg font-semibold hover:bg-sky-900 disabled:bg-sky-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLastQuestion ? "Zakończ egzamin" : "Następne pytanie"}
                </button>
              )}
            </>
          )}

          {/* Summary phase */}
          {phase === "summary" && summary && (
            <>
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">Podsumowanie egzaminu</h2>
                  <p className="text-2xl font-semibold text-sky-800">
                    Średnia ocena: {summary.average_score.toFixed(1)}/10
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-slate-900">Ogólna ocena</h3>
                      <button
                        onClick={() => {
                          const summaryMd = `# Podsumowanie egzaminu\n\nŚrednia ocena: ${summary.average_score.toFixed(1)}/10\n\n## Ogólna ocena\n\n${summary.summary}\n\n${
                            summary.strengths.length > 0 
                              ? `## Mocne strony\n\n${summary.strengths.map(s => `- ${s}`).join('\n')}\n\n` 
                              : ''
                          }${
                            summary.improvements.length > 0 
                              ? `## Obszary do poprawy\n\n${summary.improvements.map(s => `- ${s}`).join('\n')}\n\n` 
                              : ''
                          }${
                            summary.recommendations.length > 0 
                              ? `## Rekomendacje\n\n${summary.recommendations.map(s => `- ${s}`).join('\n')}` 
                              : ''
                          }`;
                          copyToClipboard(summaryMd, setCopiedSummary);
                        }}
                        className="px-3 py-1 text-sm bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
                      >
                        {copiedSummary ? "✓ Skopiowano!" : "Kopiuj .md"}
                      </button>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{summary.summary}</p>
                  </div>

                  {summary.strengths.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h3 className="font-semibold text-green-900 mb-2">Mocne strony</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {summary.strengths.map((s, i) => (
                          <li key={i} className="text-green-800">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.improvements.length > 0 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h3 className="font-semibold text-yellow-900 mb-2">Obszary do poprawy</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {summary.improvements.map((s, i) => (
                          <li key={i} className="text-yellow-800">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.recommendations.length > 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">Rekomendacje</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {summary.recommendations.map((s, i) => (
                          <li key={i} className="text-blue-800">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  // Czyszczenie stanu przed powrotem
                  sessionStorage.removeItem(STORAGE_KEYS.examState);
                  sessionStorage.removeItem(STORAGE_KEYS.examPhase);
                  sessionStorage.removeItem(STORAGE_KEYS.userAnswer);
                  setLocation("/");
                }}
                className="w-full py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
              >
                Powrót do strony głównej
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
