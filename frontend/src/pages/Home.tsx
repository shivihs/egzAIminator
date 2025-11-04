import { useState } from "react";
import { useLocation } from "wouter";
import { TECHNOLOGIES, TechnologyLevel } from "../types";

export default function Home() {
  const [, setLocation] = useLocation();
  const [selectedTech, setSelectedTech] = useState<Map<string, number>>(new Map());
  const [questionCount, setQuestionCount] = useState<number>(3);

  const toggleTechnology = (tech: string, level: number) => {
    const newSelected = new Map(selectedTech);
    if (newSelected.get(tech) === level) {
      newSelected.delete(tech);
    } else {
      newSelected.set(tech, level);
    }
    setSelectedTech(newSelected);
  };

  const startExam = () => {
    if (selectedTech.size === 0) return;
    
    const technologies: TechnologyLevel[] = Array.from(selectedTech.entries()).map(
      ([technology, level]) => ({ technology, level })
    );
    
    // Zapisujemy dane do sessionStorage zamiast URL
    sessionStorage.setItem('examConfig', JSON.stringify({
      technologies,
      questionCount
    }));
    
    setLocation("/egzaminator");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-8">
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-slate-900">egzAIminator</h1>
            <p className="text-slate-600">Wybierz technologie i poziom trudności, aby rozpocząć egzamin</p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Wybierz technologie i poziom trudności</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TECHNOLOGIES.map((tech) => (
                  <div key={tech} className="space-y-2">
                    <p className="font-medium text-slate-700">{tech}</p>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          onClick={() => toggleTechnology(tech, level)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedTech.get(tech) === level
                              ? "bg-sky-800 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          Poziom {level}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Liczba pytań</h2>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      questionCount === count
                        ? "bg-sky-800 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {selectedTech.size > 0 && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-700 mb-2">Wybrane technologie:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedTech.entries()).map(([tech, level]) => (
                    <span
                      key={tech}
                      className="px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-sm font-medium"
                    >
                      {tech} - Poziom {level}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startExam}
              disabled={selectedTech.size === 0}
              className="w-full py-4 bg-sky-800 text-white rounded-lg font-semibold text-lg hover:bg-sky-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Przeprowadź egzamin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
