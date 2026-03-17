// 데이터 모델
let transactions = [];
let selectedDateFilter = null; // 'YYYY-MM-DD' 또는 null

const STORAGE_KEY = 'student-budget-transactions-v1';

const CATEGORY_OPTIONS = {
  expense: [
    { value: 'food', label: '식비' },
    { value: 'cafe', label: '카페' },
    { value: 'transport', label: '교통' },
    { value: 'shopping', label: '쇼핑' },
    { value: 'subscription', label: '구독' },
    { value: 'etc', label: '기타' },
  ],
  income: [
    { value: 'salary', label: '월급' },
    { value: 'allowance', label: '용돈' },
    { value: 'etc', label: '기타' },
  ],
};

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      transactions = [];
      return;
    }
    const parsed = JSON.parse(raw);
    transactions = parsed.map((t) => ({
      ...t,
      date: new Date(t.date),
    }));

    // 기존 데이터 호환(카테고리 체계 변경)
    // - parttime(알바 월급) -> salary(월급)
    // - study(공부/강의) -> etc(기타)  (새 카테고리에서 제거됨)
    // - 과거에 income에 expense 카테고리가 들어가 있으면 etc로 정리
    const expenseAllowed = new Set(CATEGORY_OPTIONS.expense.map((o) => o.value));
    const incomeAllowed = new Set(CATEGORY_OPTIONS.income.map((o) => o.value));

    let mutated = false;
    transactions = transactions.map((tx) => {
      let category = tx.category;
      if (category === 'parttime') {
        category = 'salary';
        mutated = true;
      }
      if (category === 'study') {
        category = 'etc';
        mutated = true;
      }
      if (tx.type === 'expense' && !expenseAllowed.has(category)) {
        category = 'etc';
        mutated = true;
      }
      if (tx.type === 'income' && !incomeAllowed.has(category)) {
        category = 'etc';
        mutated = true;
      }
      return category === tx.category ? tx : { ...tx, category };
    });

    if (mutated) saveTransactions();
  } catch (e) {
    console.error('Failed to load from localStorage', e);
    transactions = [];
  }
}

function saveTransactions() {
  const toSave = transactions.map((t) => ({
    ...t,
    date: t.date.toISOString(),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// 유틸
function formatCurrency(amount) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

function getYearMonth(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 통계 함수
function getMonthlySummary(year, month) {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  let expense = 0;
  let income = 0;
  transactions.forEach((t) => {
    if (getYearMonth(t.date) !== ym) return;
    if (t.type === 'expense') expense += t.amount;
    else income += t.amount;
  });
  return { expense, income };
}

function getCategoryTotalsForMonth(year, month) {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const totals = {
    food: 0,
    cafe: 0,
    allowance: 0,
    transport: 0,
    shopping: 0,
    subscription: 0,
    salary: 0,
    etc: 0,
  };
  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    if (getYearMonth(t.date) !== ym) return;
    totals[t.category] += t.amount;
  });
  return totals;
}

function getCurrentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// DOM 요소 참조
const summaryExpenseEl = document.getElementById('summary-expense');
const summaryIncomeEl = document.getElementById('summary-income');
const summaryMonthEl = document.getElementById('summary-month');
const form = document.getElementById('transaction-form');
const formMessageEl = document.getElementById('form-message');
const typeSelectEl = document.getElementById('type');
const categorySelectEl = document.getElementById('category');
const analysisEmptyEl = document.getElementById('analysis-empty');
const analysisBarsEl = document.getElementById('analysis-bars');
const tipsContainerEl = document.getElementById('tips-container');
const calendarMonthEl = document.getElementById('calendar-month');
const calendarGridEl = document.getElementById('calendar-grid');
const maxExpenseDayEl = document.getElementById('max-expense-day');
const maxIncomeDayEl = document.getElementById('max-income-day');
const dayDetailEl = document.getElementById('day-detail');
const dayDetailDateEl = document.getElementById('day-detail-date');
const dayDetailExpenseEl = document.getElementById('day-detail-expense');
const dayDetailIncomeEl = document.getElementById('day-detail-income');
const dayDetailListEl = document.getElementById('day-detail-list');
const dayDetailEmptyEl = document.getElementById('day-detail-empty');
const dayDetailCloseBtn = document.getElementById('day-detail-close');

// 렌더링
function renderSummary() {
  const { year, month } = getCurrentYearMonth();
  const { expense, income } = getMonthlySummary(year, month);

  summaryExpenseEl.textContent = formatCurrency(expense);
  summaryIncomeEl.textContent = formatCurrency(income);
  summaryMonthEl.textContent = `${year}년 ${month}월 기준`;
}

function renderAnalysisAndTips() {
  const { year, month } = getCurrentYearMonth();
  const totals = getCategoryTotalsForMonth(year, month);
  const totalExpense = Object.values(totals).reduce(
    (sum, v) => sum + v,
    0
  );

  if (totalExpense === 0) {
    analysisEmptyEl.style.display = 'block';
    analysisBarsEl.innerHTML = '';
  } else {
    analysisEmptyEl.style.display = 'none';
    analysisBarsEl.innerHTML = '';

    const entries = Object.entries(totals).filter(([, v]) => v > 0);
    entries.sort((a, b) => b[1] - a[1]);

    entries.forEach(([category, amount]) => {
      const row = document.createElement('div');
      row.className = 'analysis-row';

      const label = document.createElement('div');
      label.className = 'analysis-label';
      const percent = ((amount / totalExpense) * 100).toFixed(1);
      label.textContent = `${getCategoryLabel(category)} ${percent}%`;

      const barContainer = document.createElement('div');
      barContainer.className = 'bar-container';

      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.width = `${percent}%`;
      bar.style.backgroundColor = getCategoryColor(category);
      bar.textContent = percent >= 10 ? `${percent}%` : '';

      barContainer.appendChild(bar);
      row.appendChild(label);
      row.appendChild(barContainer);
      analysisBarsEl.appendChild(row);
    });
  }

  const tips = generateSavingTips(totals, totalExpense);
  tipsContainerEl.innerHTML = '';
  tips.forEach((tip) => {
    const div = document.createElement('div');
    div.className = 'tip-card';
    div.textContent = tip;
    tipsContainerEl.appendChild(div);
  });
}

function renderAll() {
  renderCategoryOptions();
  renderSummary();
  renderAnalysisAndTips();
  renderCalendar();
  renderDayDetail();
}

// 카테고리 헬퍼
function getCategoryLabel(category) {
  switch (category) {
    case 'food':
      return '식비';
    case 'cafe':
      return '카페';
    case 'salary':
      return '월급';
    case 'allowance':
      return '용돈';
    case 'transport':
      return '교통';
    case 'shopping':
      return '쇼핑';
    case 'subscription':
      return '구독';
    case 'study':
      return '공부/강의';
    default:
      return '기타';
  }
}

function getCategoryColor(category) {
  switch (category) {
    case 'food':
      return '#e67e22';
    case 'cafe':
      return '#9b59b6';
    case 'salary':
      return '#2ecc71';
    case 'allowance':
      return '#1abc9c';
    case 'transport':
      return '#3498db';
    case 'shopping':
      return '#e74c3c';
    case 'subscription':
      return '#16a085';
    case 'study':
      return '#2980b9';
    default:
      return '#7f8c8d';
  }
}

// 절약 팁 로직
function generateSavingTips(categoryTotals, totalExpense) {
  if (!totalExpense || totalExpense === 0) {
    return [
      '아직 지출 데이터가 거의 없어요. 일주일 정도만 꾸준히 기록해 보면 소비 패턴을 분석해 줄게요.',
    ];
  }

  const tips = [];

  function ratio(cat) {
    return (categoryTotals[cat] || 0) / totalExpense;
  }

  if (ratio('food') >= 0.4) {
    tips.push(
      '식비가 전체 지출의 40% 이상이에요. 주 1~2번은 학식/집밥/편의점 도시락으로 바꿔 보면 한 달에 꽤 큰 금액을 줄일 수 있어요.'
    );
  }

  if (ratio('cafe') >= 0.2) {
    tips.push(
      '카페 지출 비중이 높아요. 주 2~3회는 텀블러+편의점 커피로 대체하면, 한 달 기준으로 만 원 이상 아낄 수 있어요.'
    );
  }

  if (ratio('shopping') >= 0.25) {
    tips.push(
      '쇼핑 비율이 25%를 넘어요. 사고 싶은 물건은 장바구니에 넣고 \"7일 지나도 여전히 갖고 싶으면 그때 구매\" 규칙을 만들어보면 충동구매를 줄일 수 있어요.'
    );
  }

  if (ratio('subscription') >= 0.15) {
    tips.push(
      '구독 서비스 지출이 전체의 15% 이상이에요. 한 달 동안 거의 안 쓴 구독 1개만 정리해도 고정비를 줄일 수 있어요.'
    );
  }

  if (ratio('transport') >= 0.2) {
    tips.push(
      '교통비 비중이 높은 편이에요. 통학 요일 중 1~2일은 같이 타는 친구를 구하거나, 대중교통 정기권/정액권이 있는지 확인해 보세요.'
    );
  }

  if (tips.length === 0) {
    tips.push(
      '전체적으로 균형 있게 소비하고 있어요. 지금 패턴을 2~3달 유지하면서, 가장 아쉬운 카테고리 한 가지만 골라 조금씩 줄여보면 좋겠어요.'
    );
  }

  return tips;
}

function renderCategoryOptions() {
  if (!typeSelectEl || !categorySelectEl) return;

  const type = typeSelectEl.value;
  const options = CATEGORY_OPTIONS[type] || CATEGORY_OPTIONS.expense;

  const current = categorySelectEl.value;
  categorySelectEl.innerHTML = '';

  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    categorySelectEl.appendChild(opt);
  });

  // 가능하면 기존 선택 유지, 아니면 첫 옵션
  const stillExists = options.some((o) => o.value === current);
  categorySelectEl.value = stillExists ? current : options[0]?.value;
}

function getDailyTotalsForMonth(year, month) {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const map = {};

  transactions.forEach((t) => {
    if (getYearMonth(t.date) !== ym) return;
    const key = formatDate(t.date);
    if (!map[key]) map[key] = { expense: 0, income: 0 };
    if (t.type === 'expense') map[key].expense += t.amount;
    else map[key].income += t.amount;
  });

  return map;
}

function renderCalendar() {
  if (!calendarGridEl) return;

  const { year, month } = getCurrentYearMonth();
  if (calendarMonthEl) calendarMonthEl.textContent = `${year}년 ${month}월`;

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0=일

  const dailyTotals = getDailyTotalsForMonth(year, month);

  // 최대값 계산
  let maxExpense = 0;
  let maxExpenseKey = null;
  let maxIncome = 0;
  let maxIncomeKey = null;
  Object.entries(dailyTotals).forEach(([key, v]) => {
    if (v.expense > maxExpense) {
      maxExpense = v.expense;
      maxExpenseKey = key;
    }
    if (v.income > maxIncome) {
      maxIncome = v.income;
      maxIncomeKey = key;
    }
  });

  if (maxExpenseDayEl) {
    maxExpenseDayEl.textContent = maxExpenseKey
      ? `${maxExpenseKey} (${formatCurrency(maxExpense)})`
      : '-';
  }
  if (maxIncomeDayEl) {
    maxIncomeDayEl.textContent = maxIncomeKey
      ? `${maxIncomeKey} (${formatCurrency(maxIncome)})`
      : '-';
  }

  calendarGridEl.innerHTML = '';

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  weekdays.forEach((w) => {
    const el = document.createElement('div');
    el.className = 'calendar-weekday';
    el.textContent = w;
    calendarGridEl.appendChild(el);
  });

  // 빈 칸 채우기
  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-cell muted';
    empty.setAttribute('aria-hidden', 'true');
    calendarGridEl.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';

    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = String(day);

    const amounts = document.createElement('div');
    amounts.className = 'day-amounts';

    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const v = dailyTotals[key] || { expense: 0, income: 0 };

    if (selectedDateFilter === key) {
      cell.classList.add('selected');
    }

    const exp = document.createElement('div');
    exp.className = 'day-expense';
    exp.textContent = v.expense > 0 ? `- ${formatCurrency(v.expense)}` : '';

    const inc = document.createElement('div');
    inc.className = 'day-income';
    inc.textContent = v.income > 0 ? `+ ${formatCurrency(v.income)}` : '';

    amounts.appendChild(exp);
    amounts.appendChild(inc);

    cell.appendChild(dayNumber);
    cell.appendChild(amounts);
    calendarGridEl.appendChild(cell);

    cell.addEventListener('click', () => {
      selectedDateFilter = key;
      renderAll();
      if (dayDetailEl) {
        dayDetailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

function renderDayDetail() {
  if (!dayDetailEl) return;

  if (!selectedDateFilter) {
    dayDetailEl.style.display = 'none';
    return;
  }

  const dayTx = transactions
    .filter((t) => formatDate(t.date) === selectedDateFilter)
    .sort((a, b) => b.date - a.date);

  const expenseSum = dayTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const incomeSum = dayTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  if (dayDetailDateEl) dayDetailDateEl.textContent = selectedDateFilter;
  if (dayDetailExpenseEl) dayDetailExpenseEl.textContent = formatCurrency(expenseSum);
  if (dayDetailIncomeEl) dayDetailIncomeEl.textContent = formatCurrency(incomeSum);

  if (dayDetailListEl) {
    dayDetailListEl.innerHTML = '';
    dayTx.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'transaction-item';

      const main = document.createElement('div');
      main.className = 'transaction-main';

      const title = document.createElement('span');
      title.className = 'transaction-title';
      title.textContent = t.memo || getCategoryLabel(t.category);

      const sub = document.createElement('span');
      sub.className = 'transaction-sub';
      sub.textContent = `${getCategoryLabel(t.category)}`;

      main.appendChild(title);
      main.appendChild(sub);

      const amount = document.createElement('span');
      amount.className = `transaction-amount ${t.type}`;
      amount.textContent =
        (t.type === 'expense' ? '-' : '+') + formatCurrency(t.amount);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-button';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', () => {
        transactions = transactions.filter((x) => x.id !== t.id);
        saveTransactions();
        renderAll();
      });

      li.appendChild(main);
      li.appendChild(amount);
      li.appendChild(delBtn);
      dayDetailListEl.appendChild(li);
    });
  }

  if (dayDetailEmptyEl) {
    dayDetailEmptyEl.style.display = dayTx.length === 0 ? 'block' : 'none';
  }

  dayDetailEl.style.display = 'block';
}

// 폼 처리
function setupForm() {
  const today = new Date();
  const dateInput = document.getElementById('date');
  dateInput.value = formatDate(today);

  if (dayDetailCloseBtn) {
    dayDetailCloseBtn.addEventListener('click', () => {
      selectedDateFilter = null;
      renderAll();
    });
  }

  if (typeSelectEl) {
    typeSelectEl.addEventListener('change', () => {
      renderCategoryOptions();
    });
  }
  renderCategoryOptions();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formMessageEl.textContent = '';
    formMessageEl.className = 'form-message';

    const type = form.type.value;
    const amount = Number(form.amount.value);
    const dateValue = form.date.value;
    const category = form.category.value;
    const memo = form.memo.value.trim();

    if (!dateValue || !amount || amount <= 0) {
      formMessageEl.textContent = '금액과 날짜를 올바르게 입력해 주세요.';
      formMessageEl.classList.add('error');
      return;
    }

    const tx = {
      id: Date.now().toString(),
      type,
      amount,
      date: new Date(dateValue),
      category,
      memo,
    };

    transactions.push(tx);
    saveTransactions();
    renderAll();

    formMessageEl.textContent = '기록이 저장되었습니다.';
    formMessageEl.classList.add('success');
    form.reset();
    dateInput.value = formatDate(today);
    renderCategoryOptions();
  });
}

// 초기화
function init() {
  loadTransactions();
  setupForm();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

