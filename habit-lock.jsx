import { useState, useEffect, useCallback } from "react";

const COLORS = [
  { bg: "#FF6B6B", light: "rgba(255,107,107,0.15)", border: "rgba(255,107,107,0.4)", text: "#FF6B6B" },
  { bg: "#4ECDC4", light: "rgba(78,205,196,0.15)", border: "rgba(78,205,196,0.4)", text: "#4ECDC4" },
  { bg: "#FFE66D", light: "rgba(255,230,109,0.15)", border: "rgba(255,230,109,0.4)", text: "#FFE66D" },
  { bg: "#A78BFA", light: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.4)", text: "#A78BFA" },
  { bg: "#F97316", light: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.4)", text: "#F97316" },
  { bg: "#06B6D4", light: "rgba(6,182,212,0.15)", border: "rgba(6,182,212,0.4)", text: "#06B6D4" },
  { bg: "#EC4899", light: "rgba(236,72,153,0.15)", border: "rgba(236,72,153,0.4)", text: "#EC4899" },
  { bg: "#84CC16", light: "rgba(132,204,22,0.15)", border: "rgba(132,204,22,0.4)", text: "#84CC16" },
];

const ICONS = ["🍺", "🚬", "🍔", "📱", "🎮", "☕", "🍫", "🛒", "💳", "🍕", "🎰", "🧁", "🥤", "📺", "🛋️"];

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS_KR = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function formatDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(d1Str, d2Str) {
  const d1 = parseDate(d1Str);
  const d2 = parseDate(d2Str);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getDaysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function getFirstDayOfMonth(y, m) {
  return new Date(y, m, 1).getDay();
}

export default function HabitLockApp() {
  const [habits, setHabits] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitDays, setNewHabitDays] = useState(4);
  const [newHabitIcon, setNewHabitIcon] = useState("🍺");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDays, setEditDays] = useState(4);
  const [editIcon, setEditIcon] = useState("");
  const [undoData, setUndoData] = useState(null);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("habit-lock-data");
        if (result && result.value) {
          setHabits(JSON.parse(result.value));
        }
      } catch (e) { /* first load */ }
      setLoaded(true);
    })();
  }, []);

  // Save data
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set("habit-lock-data", JSON.stringify(habits));
      } catch (e) { console.error(e); }
    })();
  }, [habits, loaded]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2800);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Undo auto-dismiss
  useEffect(() => {
    if (undoData) {
      const t = setTimeout(() => setUndoData(null), 5000);
      return () => clearTimeout(t);
    }
  }, [undoData]);

  const todayStr = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    const colorIdx = habits.length % COLORS.length;
    setHabits(prev => [...prev, {
      id: Date.now().toString(),
      name: newHabitName.trim(),
      cooldown: newHabitDays,
      icon: newHabitIcon,
      color: colorIdx,
      logs: [],
    }]);
    setNewHabitName("");
    setNewHabitDays(4);
    setNewHabitIcon("🍺");
    setShowAddModal(false);
    setToast("습관이 추가되었습니다");
  };

  const deleteHabit = (id) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    if (selectedHabit === id) setSelectedHabit(null);
    setConfirmDelete(null);
    setToast("삭제되었습니다");
  };

  const toggleLog = (habitId, dateStr) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      const existing = h.logs.includes(dateStr);
      if (existing) {
        setUndoData({ habitId, dateStr, action: "remove" });
        return { ...h, logs: h.logs.filter(d => d !== dateStr) };
      }
      // Check if locked
      const isLocked = h.logs.some(logDate => {
        const diff = daysBetween(logDate, dateStr);
        return diff > 0 && diff < h.cooldown;
      });
      if (isLocked) {
        setToast("🔒 아직 쿨다운 기간입니다!");
        return h;
      }
      setUndoData({ habitId, dateStr, action: "add" });
      return { ...h, logs: [...h.logs, dateStr].sort() };
    }));
  };

  const handleUndo = () => {
    if (!undoData) return;
    setHabits(prev => prev.map(h => {
      if (h.id !== undoData.habitId) return h;
      if (undoData.action === "add") {
        return { ...h, logs: h.logs.filter(d => d !== undoData.dateStr) };
      } else {
        return { ...h, logs: [...h.logs, undoData.dateStr].sort() };
      }
    }));
    setUndoData(null);
    setToast("되돌렸습니다");
  };

  const getLockedDates = (habit) => {
    const locked = new Set();
    habit.logs.forEach(logDate => {
      for (let i = 1; i < habit.cooldown; i++) {
        const d = parseDate(logDate);
        d.setDate(d.getDate() + i);
        locked.add(formatDate(d.getFullYear(), d.getMonth(), d.getDate()));
      }
    });
    return locked;
  };

  const getNextAvailable = (habit) => {
    if (habit.logs.length === 0) return null;
    const lastLog = habit.logs[habit.logs.length - 1];
    const d = parseDate(lastLog);
    d.setDate(d.getDate() + habit.cooldown);
    return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const goToday = () => {
    setCurrentMonth(new Date().getMonth());
    setCurrentYear(new Date().getFullYear());
  };

  const saveEdit = () => {
    if (!editName.trim() || !showEditModal) return;
    setHabits(prev => prev.map(h => {
      if (h.id !== showEditModal) return h;
      return { ...h, name: editName.trim(), cooldown: editDays, icon: editIcon };
    }));
    setShowEditModal(null);
    setToast("수정되었습니다");
  };

  const openEdit = (habit) => {
    setEditName(habit.name);
    setEditDays(habit.cooldown);
    setEditIcon(habit.icon);
    setShowEditModal(habit.id);
  };

  // Render calendar
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const activeHabit = habits.find(h => h.id === selectedHabit);
  const lockedDates = activeHabit ? getLockedDates(activeHabit) : new Set();
  const activeColor = activeHabit ? COLORS[activeHabit.color] : null;

  // All habits locked overlay for non-selected view
  const allHabitsData = selectedHabit ? [] : habits.map(h => ({
    ...h,
    locked: getLockedDates(h),
    c: COLORS[h.color],
  }));

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes lockShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>HABIT LOCK</h1>
            <p style={styles.subtitle}>나쁜 습관을 관리하세요</p>
          </div>
          <button onClick={() => setShowAddModal(true)} style={styles.addBtn}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
          </button>
        </div>
      </div>

      {/* Habit Bullets */}
      <div style={styles.bulletsContainer}>
        <div style={styles.bulletsScroll}>
          <button
            onClick={() => setSelectedHabit(null)}
            style={{
              ...styles.bulletChip,
              background: !selectedHabit ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
              border: !selectedHabit ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span style={{ fontSize: 14 }}>📋</span>
            <span style={{ color: !selectedHabit ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500 }}>전체</span>
          </button>
          {habits.map(h => {
            const c = COLORS[h.color];
            const isActive = selectedHabit === h.id;
            const nextDate = getNextAvailable(h);
            const isAvailable = !nextDate || daysBetween(todayStr, nextDate) <= 0;
            return (
              <button
                key={h.id}
                onClick={() => setSelectedHabit(isActive ? null : h.id)}
                style={{
                  ...styles.bulletChip,
                  background: isActive ? c.light : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isActive ? c.border : "rgba(255,255,255,0.08)"}`,
                  position: "relative",
                }}
              >
                <span style={{ fontSize: 14 }}>{h.icon}</span>
                <span style={{ color: isActive ? c.text : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500 }}>{h.name}</span>
                {!isAvailable && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    width: 10, height: 10, borderRadius: "50%",
                    background: c.bg, border: "2px solid #0D0D12",
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar */}
      <div style={styles.calendarCard}>
        <div style={styles.calendarNav}>
          <button onClick={prevMonth} style={styles.navBtn}>‹</button>
          <button onClick={goToday} style={styles.monthLabel}>
            {currentYear}년 {MONTHS_KR[currentMonth]}
          </button>
          <button onClick={nextMonth} style={styles.navBtn}>›</button>
        </div>

        <div style={styles.dayHeaders}>
          {DAYS_KR.map((d, i) => (
            <div key={d} style={{ ...styles.dayHeader, color: i === 0 ? "#FF6B6B" : i === 6 ? "#4ECDC4" : "rgba(255,255,255,0.35)" }}>{d}</div>
          ))}
        </div>

        <div style={styles.calendarGrid}>
          {calendarCells.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} style={styles.emptyCell} />;

            const dateStr = formatDate(currentYear, currentMonth, day);
            const isToday = dateStr === todayStr;
            const dayOfWeek = (firstDay + day - 1) % 7;

            // Determine state for each habit
            let cellContent = null;
            let cellBg = "transparent";
            let cellBorder = "1px solid rgba(255,255,255,0.04)";
            let isClickable = false;

            if (activeHabit) {
              const isLogged = activeHabit.logs.includes(dateStr);
              const isLocked = lockedDates.has(dateStr);
              isClickable = true;

              if (isLogged) {
                cellBg = activeColor.bg;
                cellContent = <span style={{ fontSize: 14 }}>{activeHabit.icon}</span>;
              } else if (isLocked) {
                cellBg = `repeating-linear-gradient(135deg, ${activeColor.light}, ${activeColor.light} 3px, transparent 3px, transparent 6px)`;
                cellBorder = `1px solid ${activeColor.border}`;
                cellContent = <span style={{ fontSize: 10, opacity: 0.7 }}>🔒</span>;
              }
            } else {
              // Show all habits
              const dots = allHabitsData.filter(h => h.logs.includes(dateStr));
              const locks = allHabitsData.filter(h => !h.logs.includes(dateStr) && h.locked.has(dateStr));
              if (dots.length > 0) {
                cellContent = (
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                    {dots.map(h => (
                      <span key={h.id} style={{ fontSize: 8 }}>{h.icon}</span>
                    ))}
                  </div>
                );
              }
              if (locks.length > 0 && dots.length === 0) {
                cellBg = "rgba(255,255,255,0.02)";
                cellContent = (
                  <div style={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                    {locks.slice(0, 3).map(h => (
                      <span key={h.id} style={{ width: 5, height: 5, borderRadius: "50%", background: h.c.bg, opacity: 0.35 }} />
                    ))}
                  </div>
                );
              }
            }

            return (
              <button
                key={day}
                onClick={() => activeHabit && toggleLog(activeHabit.id, dateStr)}
                style={{
                  ...styles.dayCell,
                  background: cellBg,
                  border: cellBorder,
                  cursor: activeHabit ? "pointer" : "default",
                  position: "relative",
                }}
              >
                <span style={{
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? "#fff" : dayOfWeek === 0 ? "rgba(255,107,107,0.7)" : dayOfWeek === 6 ? "rgba(78,205,196,0.7)" : "rgba(255,255,255,0.55)",
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {day}
                </span>
                {isToday && (
                  <div style={{
                    position: "absolute", top: 3, right: 3,
                    width: 4, height: 4, borderRadius: "50%",
                    background: "#fff",
                  }} />
                )}
                {cellContent && <div style={{ marginTop: 1 }}>{cellContent}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Habit Detail Cards */}
      <div style={styles.cardsSection}>
        {(activeHabit ? [activeHabit] : habits).map(h => {
          const c = COLORS[h.color];
          const nextDate = getNextAvailable(h);
          const isAvailable = !nextDate || daysBetween(todayStr, nextDate) <= 0;
          const daysLeft = nextDate ? Math.max(0, daysBetween(todayStr, nextDate)) : 0;
          const totalLogs = h.logs.length;
          const thisMonthLogs = h.logs.filter(d => d.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`)).length;

          return (
            <div key={h.id} style={{ ...styles.habitCard, borderLeft: `3px solid ${c.bg}`, animation: "fadeIn 0.3s ease" }}>
              <div style={styles.habitCardTop}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{h.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>
                      {h.cooldown}일 쿨다운
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(h)} style={styles.smallBtn}>✏️</button>
                  <button onClick={() => setConfirmDelete(h.id)} style={styles.smallBtn}>🗑</button>
                </div>
              </div>

              <div style={styles.statusRow}>
                <div style={{
                  ...styles.statusBadge,
                  background: isAvailable ? "rgba(78,205,196,0.15)" : "rgba(255,107,107,0.15)",
                  color: isAvailable ? "#4ECDC4" : "#FF6B6B",
                }}>
                  {isAvailable ? "✅ 가능" : `🔒 ${daysLeft}일 남음`}
                </div>
                <div style={styles.statGroup}>
                  <div style={styles.stat}>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>이번 달</span>
                    <span style={{ color: c.text, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{thisMonthLogs}</span>
                  </div>
                  <div style={styles.stat}>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>전체</span>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{totalLogs}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {!isAvailable && (
                <div style={styles.progressContainer}>
                  <div style={{
                    height: "100%",
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${c.bg}, ${c.bg}88)`,
                    width: `${((h.cooldown - daysLeft) / h.cooldown) * 100}%`,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              )}
            </div>
          );
        })}

        {habits.length === 0 && (
          <div style={styles.emptyState}>
            <span style={{ fontSize: 40, marginBottom: 12 }}>🎯</span>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6 }}>
              아직 등록된 습관이 없습니다<br />
              <span style={{ color: "rgba(255,255,255,0.25)" }}>+ 버튼을 눌러 관리할 습관을 추가하세요</span>
            </p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={styles.overlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>새 습관 추가</h2>

            <label style={styles.label}>아이콘</label>
            <div style={styles.iconGrid}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setNewHabitIcon(ic)} style={{
                  ...styles.iconBtn,
                  background: newHabitIcon === ic ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                  border: newHabitIcon === ic ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                }}>
                  {ic}
                </button>
              ))}
            </div>

            <label style={styles.label}>습관 이름</label>
            <input
              value={newHabitName}
              onChange={e => setNewHabitName(e.target.value)}
              placeholder="예: 음주, 야식, SNS..."
              style={styles.input}
              onKeyDown={e => e.key === "Enter" && addHabit()}
            />

            <label style={styles.label}>쿨다운 기간 (일)</label>
            <div style={styles.daysSelector}>
              {[2, 3, 4, 5, 7, 10, 14, 30].map(d => (
                <button key={d} onClick={() => setNewHabitDays(d)} style={{
                  ...styles.dayOption,
                  background: newHabitDays === d ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                  border: newHabitDays === d ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                  color: newHabitDays === d ? "#fff" : "rgba(255,255,255,0.4)",
                }}>
                  {d}일
                </button>
              ))}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowAddModal(false)} style={styles.cancelBtn}>취소</button>
              <button onClick={addHabit} style={{ ...styles.confirmBtn, opacity: newHabitName.trim() ? 1 : 0.4 }}>추가하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div style={styles.overlay} onClick={() => setShowEditModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>습관 수정</h2>

            <label style={styles.label}>아이콘</label>
            <div style={styles.iconGrid}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setEditIcon(ic)} style={{
                  ...styles.iconBtn,
                  background: editIcon === ic ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                  border: editIcon === ic ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                }}>
                  {ic}
                </button>
              ))}
            </div>

            <label style={styles.label}>습관 이름</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={styles.input}
              onKeyDown={e => e.key === "Enter" && saveEdit()}
            />

            <label style={styles.label}>쿨다운 기간 (일)</label>
            <div style={styles.daysSelector}>
              {[2, 3, 4, 5, 7, 10, 14, 30].map(d => (
                <button key={d} onClick={() => setEditDays(d)} style={{
                  ...styles.dayOption,
                  background: editDays === d ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                  border: editDays === d ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                  color: editDays === d ? "#fff" : "rgba(255,255,255,0.4)",
                }}>
                  {d}일
                </button>
              ))}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowEditModal(null)} style={styles.cancelBtn}>취소</button>
              <button onClick={saveEdit} style={styles.confirmBtn}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div style={styles.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...styles.modal, maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <p style={{ color: "#fff", fontSize: 15, textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              정말 삭제하시겠습니까?<br />
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>모든 기록이 함께 삭제됩니다</span>
            </p>
            <div style={styles.modalActions}>
              <button onClick={() => setConfirmDelete(null)} style={styles.cancelBtn}>취소</button>
              <button onClick={() => deleteHabit(confirmDelete)} style={{ ...styles.confirmBtn, background: "#FF6B6B" }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={styles.toast}>{toast}</div>
      )}

      {/* Undo */}
      {undoData && (
        <div style={styles.undoBar}>
          <span style={{ fontSize: 13 }}>기록이 {undoData.action === "add" ? "추가" : "삭제"}되었습니다</span>
          <button onClick={handleUndo} style={styles.undoBtn}>되돌리기</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Noto Sans KR', sans-serif",
    background: "#0D0D12",
    minHeight: "100vh",
    color: "#fff",
    paddingBottom: 100,
    maxWidth: 480,
    margin: "0 auto",
    position: "relative",
  },
  header: {
    padding: "28px 20px 12px",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: 3,
    color: "#fff",
    fontFamily: "'Space Mono', monospace",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginTop: 4,
    fontWeight: 300,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bulletsContainer: {
    padding: "8px 20px 12px",
    overflowX: "auto",
  },
  bulletsScroll: {
    display: "flex",
    gap: 8,
    flexWrap: "nowrap",
  },
  bulletChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 20,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  calendarCard: {
    margin: "8px 16px",
    padding: 16,
    background: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  calendarNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "none",
    color: "rgba(255,255,255,0.6)",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Space Mono', monospace",
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  dayHeaders: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
    marginBottom: 6,
  },
  dayHeader: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 500,
    padding: "4px 0",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
  },
  emptyCell: {
    aspectRatio: "1",
  },
  dayCell: {
    aspectRatio: "1",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    padding: 2,
    transition: "all 0.15s ease",
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  cardsSection: {
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  habitCard: {
    padding: "16px 18px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  habitCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "rgba(255,255,255,0.05)",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  statusBadge: {
    padding: "5px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
  },
  statGroup: {
    display: "flex",
    gap: 16,
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  progressContainer: {
    marginTop: 12,
    height: 4,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 20px",
    animation: "fadeIn 0.5s ease",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    animation: "fadeIn 0.2s ease",
    padding: 20,
  },
  modal: {
    background: "#1A1A24",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    border: "1px solid rgba(255,255,255,0.1)",
    animation: "slideUp 0.3s ease",
    maxHeight: "85vh",
    overflowY: "auto",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 24,
    color: "#fff",
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 8,
    fontWeight: 500,
  },
  iconGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#fff",
    fontSize: 14,
    outline: "none",
    marginBottom: 20,
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  daysSelector: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 28,
  },
  dayOption: {
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
    fontFamily: "'Space Mono', monospace",
  },
  modalActions: {
    display: "flex",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 500,
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  confirmBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: 12,
    background: "#4ECDC4",
    border: "none",
    color: "#0D0D12",
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 600,
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  toast: {
    position: "fixed",
    bottom: 80,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(30,30,42,0.95)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    padding: "10px 24px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
    zIndex: 200,
    animation: "toastIn 0.3s ease",
    backdropFilter: "blur(12px)",
    whiteSpace: "nowrap",
  },
  undoBar: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(30,30,42,0.95)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "10px 16px",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    gap: 14,
    zIndex: 200,
    animation: "toastIn 0.3s ease",
    backdropFilter: "blur(12px)",
    color: "rgba(255,255,255,0.7)",
    whiteSpace: "nowrap",
  },
  undoBtn: {
    background: "rgba(78,205,196,0.2)",
    border: "1px solid rgba(78,205,196,0.3)",
    color: "#4ECDC4",
    padding: "5px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Noto Sans KR', sans-serif",
  },
};
