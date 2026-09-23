import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  Award,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  useTrainingModules,
  useTrainingRecommendations,
  apiGetTrainingModule,
  apiSubmitTrainingQuiz,
} from '../api/useApi';
import type {
  TrainingModuleDetail,
  TrainingSubmitResponse,
} from '../types';

interface TrainingPageProps {
  operatorId?: string;
}

export const TrainingPage: React.FC<TrainingPageProps> = ({ operatorId = 'OP1001' }) => {
  const {
    data: modules,
    loading: modulesLoading,
    refresh: refreshModules,
  } = useTrainingModules(operatorId);

  const {
    data: recommendations,
    loading: recsLoading,
    refresh: refreshRecs,
  } = useTrainingRecommendations(operatorId);

  const [activeTab, setActiveTab] = useState<'recommended' | 'available' | 'completed'>('recommended');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [moduleDetail, setModuleDetail] = useState<TrainingModuleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<TrainingSubmitResponse | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Auto-switch to available if no recommendations
  useEffect(() => {
    if (recommendations && recommendations.length === 0 && activeTab === 'recommended') {
      setActiveTab('available');
    }
  }, [recommendations]);

  const handleOpenModule = async (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setDetailLoading(true);
    setQuizResult(null);
    setSelectedAnswers({});
    setQuizError(null);

    try {
      const detail = await apiGetTrainingModule(moduleId, operatorId);
      setModuleDetail(detail);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load module details.';
      setQuizError(errorMsg);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedModuleId(null);
    setModuleDetail(null);
    setQuizResult(null);
    setSelectedAnswers({});
    setQuizError(null);
  };

  const handleSelectAnswer = (questionId: string, choiceKey: string) => {
    if (quizResult) return; // Prevent change after submission
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: choiceKey,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!selectedModuleId || !moduleDetail) return;

    // Check that all questions have been answered
    const unanswered = moduleDetail.questions.filter((q) => !selectedAnswers[q.id]);
    if (unanswered.length > 0) {
      setQuizError(`Please select an answer for all ${moduleDetail.questions.length} questions before submitting.`);
      return;
    }

    setSubmittingQuiz(true);
    setQuizError(null);

    try {
      const result = await apiSubmitTrainingQuiz(selectedModuleId, selectedAnswers, operatorId);
      setQuizResult(result);
      await Promise.allSettled([refreshModules(), refreshRecs()]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit quiz.';
      setQuizError(errorMsg);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizResult(null);
    setSelectedAnswers({});
    setQuizError(null);
  };

  const completedModules = (modules || []).filter((m) => m.completed);
  const availableModules = modules || [];

  return (
    <div className="training-container">
      {/* Top Header */}
      <div className="training-header">
        <div className="training-title-group">
          <div className="training-icon-box">
            <GraduationCap size={24} color="var(--cat-yellow)" />
          </div>
          <div>
            <h2 className="training-heading">Contextual Training Hub</h2>
            <p className="training-subheading">
              Bite-sized, event-triggered micro-learning modules designed to improve safety and machine efficiency.
            </p>
          </div>
        </div>

        <div className="training-stats-bar">
          <div className="training-stat-badge">
            <Award size={16} color="var(--cat-yellow)" />
            <span>
              <strong>{completedModules.length}</strong> / {availableModules.length} Completed
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="training-tabs-row">
        <button
          className={`training-tab-btn ${activeTab === 'recommended' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommended')}
        >
          <Sparkles size={16} color="var(--cat-yellow)" />
          <span>Recommended for Shift</span>
          {recommendations && recommendations.length > 0 && (
            <span className="training-tab-counter">{recommendations.length}</span>
          )}
        </button>

        <button
          className={`training-tab-btn ${activeTab === 'available' ? 'active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          <BookOpen size={16} />
          <span>All Modules</span>
          <span className="training-tab-counter neutral">{availableModules.length}</span>
        </button>

        <button
          className={`training-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <CheckCircle2 size={16} />
          <span>Completed ({completedModules.length})</span>
        </button>
      </div>

      {/* Content depending on active tab */}
      {activeTab === 'recommended' && (
        <div className="training-tab-content">
          {recsLoading ? (
            <div className="training-loading-state">Evaluating shift incidents & telemetry events...</div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="recommendations-grid">
              {recommendations.map((rec) => (
                <div key={rec.module.id} className="recommendation-card">
                  <div className="rec-card-badge-row">
                    <span className="rec-context-badge">
                      <Sparkles size={13} color="var(--cat-yellow)" />
                      <span>Shift Event Triggered</span>
                    </span>
                    <span className="badge-category">{rec.module.category}</span>
                  </div>

                  <h3 className="rec-module-title">{rec.module.title}</h3>
                  <p className="rec-module-desc">{rec.module.description}</p>

                  <div className="rec-reason-callout">
                    <AlertCircle size={15} color="var(--cat-yellow)" />
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>Why this is recommended:</strong>
                      <div className="rec-reason-text">{rec.reason}</div>
                    </div>
                  </div>

                  <div className="rec-card-footer">
                    <div className="rec-meta">
                      <span><Clock size={13} /> {rec.module.estimated_minutes} min</span>
                      <span><HelpCircle size={13} /> {rec.module.question_count} Questions</span>
                    </div>

                    <button
                      className="btn btn-primary btn-sm rec-start-btn"
                      onClick={() => handleOpenModule(rec.module.id)}
                    >
                      <span>Start Module</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-training-box">
              <CheckCircle2 size={36} color="#10B981" />
              <h3>All Clear · No Training Triggered</h3>
              <p>
                No active safety incidents or high idle events have triggered training recommendations for this shift.
                You can still browse and review all available modules in the All Modules tab.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'available' && (
        <div className="training-tab-content">
          {modulesLoading ? (
            <div className="training-loading-state">Loading training catalog...</div>
          ) : (
            <div className="modules-grid">
              {availableModules.map((mod) => (
                <div key={mod.id} className={`module-card ${mod.completed ? 'completed-card' : ''}`}>
                  <div className="module-card-top">
                    <span className="badge-category">{mod.category}</span>
                    {mod.completed && (
                      <span className="module-completed-badge">
                        <CheckCircle2 size={13} /> Completed ({mod.last_score}/{mod.total_questions})
                      </span>
                    )}
                  </div>

                  <h3 className="module-title">{mod.title}</h3>
                  <p className="module-desc">{mod.description}</p>

                  <div className="module-footer">
                    <div className="module-meta">
                      <span><Clock size={13} /> {mod.estimated_minutes} min</span>
                      <span><HelpCircle size={13} /> {mod.question_count} Questions</span>
                    </div>

                    <button
                      className={`btn btn-sm ${mod.completed ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleOpenModule(mod.id)}
                    >
                      <span>{mod.completed ? 'Review / Retake' : 'Begin Module'}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div className="training-tab-content">
          {completedModules.length > 0 ? (
            <div className="modules-grid">
              {completedModules.map((mod) => (
                <div key={mod.id} className="module-card completed-card">
                  <div className="module-card-top">
                    <span className="badge-category">{mod.category}</span>
                    <span className="module-completed-badge">
                      <CheckCircle2 size={13} /> Score: {mod.last_score} / {mod.total_questions}
                    </span>
                  </div>

                  <h3 className="module-title">{mod.title}</h3>
                  <p className="module-desc">{mod.description}</p>

                  <div className="module-footer">
                    <div className="module-meta">
                      <span><Clock size={13} /> {mod.estimated_minutes} min</span>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenModule(mod.id)}
                    >
                      <RotateCcw size={13} />
                      <span>Retake Quiz</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-training-box">
              <BookOpen size={36} color="var(--text-muted)" />
              <h3>No Modules Completed Yet</h3>
              <p>Complete your first micro-training module to build your operator qualification profile.</p>
            </div>
          )}
        </div>
      )}

      {/* Interactive Quiz Modal */}
      {selectedModuleId && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content quiz-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="quiz-header-title">
                <GraduationCap size={20} color="var(--cat-yellow)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                    {moduleDetail ? moduleDetail.module.title : 'Loading Training Module...'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Operator Knowledge Check · Caterpillar Standards
                  </span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body quiz-modal-body">
              {detailLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading module educational content and quiz questions...
                </div>
              ) : moduleDetail ? (
                <>
                  {/* Educational Context Overview */}
                  <div className="quiz-overview-banner">
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      {moduleDetail.module.description}
                    </p>
                  </div>

                  {/* Submission Result Banner */}
                  {quizResult && (
                    <div className={`quiz-result-banner ${quizResult.completed ? 'passed' : 'failed'}`}>
                      <div className="result-banner-header">
                        <CheckCircle2 size={24} color={quizResult.completed ? '#10B981' : 'var(--cat-yellow)'} />
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                            Quiz Submitted: {quizResult.score} / {quizResult.total} Correct (
                            {Math.round((quizResult.score / quizResult.total) * 100)}%)
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {quizResult.completed
                              ? 'Module successfully completed and recorded to operator shift log.'
                              : 'Review the explanations below and try again to master this standard.'}
                          </span>
                        </div>
                      </div>

                      <div style={{ marginTop: '0.75rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleRetakeQuiz}>
                          <RotateCcw size={13} />
                          <span>Retake Quiz</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {quizError && (
                    <div className="quiz-error-banner">
                      <AlertCircle size={16} />
                      <span>{quizError}</span>
                    </div>
                  )}

                  {/* Questions List */}
                  <div className="quiz-questions-list">
                    {moduleDetail.questions.map((q, index) => {
                      const selected = selectedAnswers[q.id];
                      const feedback = quizResult?.feedback?.find((f) => f.question_id === q.id);

                      return (
                        <div key={q.id} className="quiz-question-box">
                          <div className="question-header">
                            <span className="question-num">Question {index + 1} of {moduleDetail.questions.length}</span>
                            {feedback && (
                              <span className={`feedback-badge ${feedback.correct ? 'correct' : 'incorrect'}`}>
                                {feedback.correct ? '✓ Correct' : '✗ Incorrect'}
                              </span>
                            )}
                          </div>

                          <h4 className="question-text">{q.question}</h4>

                          <div className="choices-group">
                            {q.choices.map((choice) => {
                              const isChecked = selected === choice.key;
                              return (
                                <label
                                  key={choice.key}
                                  className={`choice-item ${isChecked ? 'selected' : ''} ${quizResult ? 'disabled' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`question-${q.id}`}
                                    value={choice.key}
                                    checked={isChecked}
                                    onChange={() => handleSelectAnswer(q.id, choice.key)}
                                    disabled={Boolean(quizResult)}
                                  />
                                  <span className="choice-key">{choice.key}</span>
                                  <span className="choice-text">{choice.text}</span>
                                </label>
                              );
                            })}
                          </div>

                          {/* Post-submission explanation */}
                          {feedback && (
                            <div className="explanation-callout">
                              <strong>Operational Standard:</strong> {feedback.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                Close
              </button>
              {!quizResult && (
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitQuiz}
                  disabled={submittingQuiz || detailLoading}
                >
                  {submittingQuiz ? 'Grading Answers...' : 'Submit Answers'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
