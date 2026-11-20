<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { userAPI } from "@bit-labs.cn/owl-ui/api/user";
import { siteTitle } from "@bit-labs.cn/owl-ui/config/siteBrand";
import { useRenderIcon } from "@bit-labs.cn/owl-ui/components/ReIcon/src/hooks";
import { enterSubApp } from "@bit-labs.cn/owl-ui/router/utils";
import { useUserStoreHook } from "@bit-labs.cn/owl-ui/store/modules/user";

defineOptions({
  name: "BitLabsApps"
});

interface MenuNode {
  name?: string;
  subApp?: string;
  meta?: { title?: string; icon?: string; showLink?: boolean };
  children?: MenuNode[];
}

interface AppEntry {
  subApp: string;
  title: string;
  icon?: string;
  summary: string;
  code: string;
  tags: string[];
  category: "content" | "cloud" | "system";
}

/** 现代企业级科技感配色盘 */
const CARD_ACCENTS = [
  "#3b82f6", // 电光蓝
  "#8b5cf6", // 极光紫
  "#ec4899", // 霓虹粉
  "#f97316", // 活力橙
  "#eab308", // 琥珀金
  "#10b981", // 翡翠绿
  "#06b6d4", // 青空蓝
  "#6366f1"  // 科技靛
] as const;

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const multiRootTitle: Record<string, string> = {
  admin: "平台管理"
};

const loading = ref(true);
const loadError = ref(false);
const entering = ref("");
const entries = ref<AppEntry[]>([]);
const clock = reactive({ time: "", date: "" });
const isDark = ref(true);

// 搜索与过滤交互状态
const searchQuery = ref("");
const activeCategory = ref<"all" | "pinned" | "content" | "cloud" | "system">("all");
const pinnedApps = ref<string[]>([]);
const searchInputRef = ref<HTMLInputElement | null>(null);

// 转场进入模态弹窗状态
const launchModalVisible = ref(false);
const launchTarget = ref<AppEntry | null>(null);
const launchProgress = ref(0);
const launchStatusText = ref("");
let launchTimer: ReturnType<typeof setTimeout> | undefined;
let progressTimer: ReturnType<typeof setInterval> | undefined;

// Toast 提示
const toastVisible = ref(false);
const toastText = ref("");
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const userStore = useUserStoreHook();
const title = computed(() => siteTitle() || "比特实验室");
const who = computed(() => userStore.nickname || userStore.username || "超级管理员");

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function accentOf(index: number): string {
  return CARD_ACCENTS[index % CARD_ACCENTS.length];
}

function visibleTitle(menu: MenuNode): string {
  if (menu.meta?.showLink === false) return "";
  return menu.meta?.title?.trim() ?? "";
}

function summaryOf(roots: MenuNode[]): string {
  if (roots.length > 1) {
    return roots.map(visibleTitle).filter(Boolean).join("、");
  }
  const children = roots[0]?.children ?? [];
  return children.map(visibleTitle).filter(Boolean).join("、");
}

function titleOf(subApp: string, roots: MenuNode[]): string {
  if (roots.length > 1) return multiRootTitle[subApp] || summaryOf(roots) || subApp;
  return visibleTitle(roots[0]) || subApp;
}

/** 智能推导英文代号 */
function codeOf(subApp: string): string {
  if (!subApp) return "APP";
  const upper = subApp.toUpperCase();
  if (upper.includes("PORTAL")) return "OWL-PORTAL";
  if (upper.includes("CMS")) return "OWL-CMS";
  if (upper.includes("COMMENT")) return "OWL-COMMENT";
  if (upper.includes("SMS")) return "OWL-SMS";
  if (upper.includes("FIREFLY")) return "FIREFLY-CLOUD";
  if (upper.includes("METRIC")) return "OWL-METRICS";
  if (upper.includes("VLINK") || upper.includes("LINK")) return "V-LINK SERVICE";
  if (upper.includes("ADMIN")) return "OWL-ADMIN";
  return `OWL-${upper}`;
}

/** 智能推导业务分类 */
function categoryOf(subApp: string, title: string): "content" | "cloud" | "system" {
  const s = (subApp + " " + title).toLowerCase();
  if (s.includes("portal") || s.includes("cms") || s.includes("comment") || s.includes("官网") || s.includes("内容") || s.includes("评论")) {
    return "content";
  }
  if (s.includes("sms") || s.includes("firefly") || s.includes("cloud") || s.includes("短信") || s.includes("云") || s.includes("通信")) {
    return "cloud";
  }
  return "system";
}

/** 提取功能标签 */
function tagsOf(summary: string): string[] {
  if (!summary) return [];
  return summary
    .split(/、|\s+|,/)
    .map(t => t.trim().replace(/\.+$/, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function groupMenus(menus: MenuNode[]): AppEntry[] {
  const groups = new Map<string, MenuNode[]>();
  for (const menu of menus) {
    if (!menu || menu.meta?.showLink === false) continue;
    const key = String(menu.subApp || menu.name || "");
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(menu);
    groups.set(key, list);
  }
  const result: AppEntry[] = [];
  for (const [subApp, roots] of groups) {
    const icon = roots.find(item => item.meta?.icon)?.meta?.icon;
    const subTitle = titleOf(subApp, roots);
    const summary = summaryOf(roots);
    result.push({
      subApp,
      title: subTitle,
      icon: typeof icon === "string" ? icon : undefined,
      summary,
      code: codeOf(subApp),
      tags: tagsOf(summary),
      category: categoryOf(subApp, subTitle)
    });
  }
  return result;
}

// 过滤后的条目列表
const filteredEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return entries.value.filter(item => {
    // 分类匹配
    if (activeCategory.value === "pinned") {
      if (!pinnedApps.value.includes(item.subApp)) return false;
    } else if (activeCategory.value !== "all") {
      if (item.category !== activeCategory.value) return false;
    }
    // 搜索匹配
    if (!q) return true;
    const inTitle = item.title.toLowerCase().includes(q);
    const inCode = item.code.toLowerCase().includes(q);
    const inSummary = item.summary.toLowerCase().includes(q);
    const inTags = item.tags.some(tag => tag.toLowerCase().includes(q));
    return inTitle || inCode || inSummary || inTags;
  });
});

// 分类数量统计
const countAll = computed(() => entries.value.length);
const countPinned = computed(() => pinnedApps.value.length);
const countContent = computed(() => entries.value.filter(e => e.category === "content").length);
const countCloud = computed(() => entries.value.filter(e => e.category === "cloud").length);
const countSystem = computed(() => entries.value.filter(e => e.category === "system").length);

async function loadEntries() {
  loading.value = true;
  loadError.value = false;
  try {
    const res = await userAPI.getAsyncRoutes();
    const menus = Array.isArray(res?.data) ? (res.data as MenuNode[]) : [];
    entries.value = groupMenus(menus);
  } catch {
    entries.value = [];
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

/** 显示 Toast 通知 */
function showToast(msg: string) {
  toastText.value = msg;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 2200);
}

/** 收藏 / 取消置顶 */
function togglePin(event: Event, subApp: string) {
  event.stopPropagation();
  const idx = pinnedApps.value.indexOf(subApp);
  if (idx > -1) {
    pinnedApps.value.splice(idx, 1);
    showToast("📌 已从常用列表移除");
  } else {
    pinnedApps.value.push(subApp);
    showToast("⭐ 已设为常用子系统");
  }
  try {
    localStorage.setItem("bit_labs_pinned_apps", JSON.stringify(pinnedApps.value));
  } catch {
    // 忽略异常
  }
}

function isPinned(subApp: string): boolean {
  return pinnedApps.value.includes(subApp);
}

/** 鼠标聚光灯高光移动 */
function onCardMouseMove(event: MouseEvent) {
  const card = event.currentTarget as HTMLElement | null;
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  card.style.setProperty("--mouse-x", `${x}px`);
  card.style.setProperty("--mouse-y", `${y}px`);
}

/** 进入子系统并触发转场动画 */
async function enter(item: AppEntry) {
  if (entering.value) return;
  entering.value = item.subApp;
  launchTarget.value = item;
  launchProgress.value = 10;
  launchStatusText.value = `正在连接 [${item.title}] 路由中枢并同步权限凭据...`;
  launchModalVisible.value = true;

  if (progressTimer) clearInterval(progressTimer);
  if (launchTimer) clearTimeout(launchTimer);

  progressTimer = setInterval(() => {
    launchProgress.value += Math.floor(Math.random() * 25) + 15;
    if (launchProgress.value >= 100) {
      launchProgress.value = 100;
      if (progressTimer) clearInterval(progressTimer);
      launchStatusText.value = `鉴权已通过，正在跳转进入 ${item.title}...`;
    } else if (launchProgress.value > 50) {
      launchStatusText.value = "加载子系统模块与工作空间环境...";
    }
  }, 160);

  try {
    await enterSubApp([item.subApp, "notify", "admin"]);
  } finally {
    // 留出平滑转场动画时间
    launchTimer = setTimeout(() => {
      closeLaunchModal();
      entering.value = "";
    }, 450);
  }
}

/** 取消进入 */
function closeLaunchModal() {
  if (progressTimer) clearInterval(progressTimer);
  if (launchTimer) clearTimeout(launchTimer);
  launchModalVisible.value = false;
  entering.value = "";
  launchProgress.value = 0;
}

/** 立即跳转 */
function confirmFastEnter() {
  launchProgress.value = 100;
  launchStatusText.value = "加速跳转中...";
  setTimeout(() => {
    closeLaunchModal();
  }, 250);
}

/** 切换暗夜/白天主题 */
function toggleTheme() {
  isDark.value = !isDark.value;
  const html = document.documentElement;
  if (isDark.value) {
    html.classList.add("dark");
    html.classList.remove("light");
    showToast("🌙 已切换为深色科技主题");
  } else {
    html.classList.remove("dark");
    html.classList.add("light");
    showToast("☀️ 已切换为明亮办公主题");
  }
  try {
    localStorage.setItem("bit_labs_theme_mode", isDark.value ? "dark" : "light");
  } catch {
    // ignore
  }
}

function logout() {
  userStore.logOut();
}

function tick() {
  const now = new Date();
  clock.time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  clock.date = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${
    WEEKDAYS[now.getDay()]
  }`;
}

/** 全局快捷键监听 */
function handleKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchInputRef.value?.focus();
    searchInputRef.value?.select();
  } else if (e.key === "/" && document.activeElement !== searchInputRef.value) {
    e.preventDefault();
    searchInputRef.value?.focus();
  } else if (e.key === "Escape") {
    if (launchModalVisible.value) {
      closeLaunchModal();
    } else if (searchQuery.value) {
      searchQuery.value = "";
    }
  }
}

let clockTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  tick();
  clockTimer = setInterval(tick, 1000);
  void loadEntries();

  // 读取置顶偏好
  try {
    const rawPinned = localStorage.getItem("bit_labs_pinned_apps");
    if (rawPinned) {
      pinnedApps.value = JSON.parse(rawPinned);
    } else {
      pinnedApps.value = ["portal", "admin"];
    }
  } catch {
    pinnedApps.value = [];
  }

  // 读取深浅主题偏好
  try {
    const savedTheme = localStorage.getItem("bit_labs_theme_mode");
    if (savedTheme) {
      isDark.value = savedTheme === "dark";
    } else {
      isDark.value = document.documentElement.classList.contains("dark");
    }
  } catch {
    isDark.value = true;
  }

  window.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (progressTimer) clearInterval(progressTimer);
  if (launchTimer) clearTimeout(launchTimer);
  if (toastTimer) clearTimeout(toastTimer);
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div class="apps-page" :class="{ 'theme-dark': isDark, 'theme-light': !isDark }">
    <!-- 背景流光与微点阵 -->
    <div class="ambient-layer" aria-hidden="true">
      <div class="ambient-grid"></div>
      <div class="ambient-glow glow-1"></div>
      <div class="ambient-glow glow-2"></div>
    </div>

    <!-- 顶部状态导航栏 -->
    <header class="apps-top">
      <div class="apps-brand">
        <span class="apps-mark" aria-hidden="true">
          <span class="apps-mark-dot"></span>
          <span class="apps-mark-dot"></span>
          <span class="apps-mark-dot"></span>
          <span class="apps-mark-dot"></span>
        </span>
        <div class="apps-brand-text">
          <strong class="apps-brand-name">{{ title }}</strong>
          <span class="apps-brand-badge">PORTAL HUB</span>
        </div>
      </div>

      <div class="apps-top-right">
        <!-- 集群健康状态 -->
        <div class="apps-status-pill" title="所有服务集群调度正常">
          <span class="status-pulse"></span>
          <span class="status-text">{{ countAll }} 个系统就绪</span>
        </div>

        <!-- 实时数字时钟 -->
        <div class="apps-clock">
          <span class="apps-clock-time">{{ clock.time }}</span>
          <span class="apps-clock-date">{{ clock.date }}</span>
        </div>

        <span class="apps-divider" aria-hidden="true"></span>

        <!-- 主题切换 -->
        <button
          type="button"
          class="apps-icon-btn"
          :title="isDark ? '切换至明亮办公模式' : '切换至深色科技模式'"
          @click="toggleTheme"
        >
          <!-- 太阳 / 月亮图标 -->
          <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>

        <!-- 当前用户卡片 -->
        <div class="apps-user-badge">
          <div class="user-avatar">{{ who.slice(0, 1) }}</div>
          <span class="apps-who">{{ who }}</span>
        </div>

        <!-- 退出登录 -->
        <button
          type="button"
          class="apps-logout"
          title="退出登录"
          @click="logout"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>退出</span>
        </button>
      </div>
    </header>

    <!-- 主操作工作台 -->
    <main class="apps-main">
      <div class="apps-hero">
        <p class="apps-eyebrow">
          <span class="apps-dot" aria-hidden="true"></span>
          <span>BIT-LABS UNIFIED GATEWAY</span>
        </p>
        <h1 class="apps-hero-title">进入子系统</h1>
        <p class="apps-hero-lead">
          集中调度开通的专属业务与支撑平台，一键快速进入或直达核心业务模块
        </p>

        <!-- 全局快速搜索与分类栏 -->
        <div class="apps-command-bar">
          <div class="apps-search-box">
            <svg class="apps-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              class="apps-search-input"
              placeholder="搜索子系统名称、代号、业务模块（按 ⌘K 或 / 快速聚焦）"
              autocomplete="off"
            />
            <div class="apps-shortcut-tag">
              <span>⌘</span>
              <span>K</span>
            </div>
          </div>

          <!-- 分类过滤选项卡 -->
          <div class="apps-filter-tabs">
            <button
              type="button"
              class="apps-tab-btn"
              :class="{ active: activeCategory === 'all' }"
              @click="activeCategory = 'all'"
            >
              全部开通 <span class="tab-badge">{{ countAll }}</span>
            </button>
            <button
              type="button"
              class="apps-tab-btn"
              :class="{ active: activeCategory === 'pinned' }"
              @click="activeCategory = 'pinned'"
            >
              ⭐ 常用置顶 <span class="tab-badge">{{ countPinned }}</span>
            </button>
            <button
              type="button"
              class="apps-tab-btn"
              :class="{ active: activeCategory === 'content' }"
              @click="activeCategory = 'content'"
            >
              门户与运营 <span class="tab-badge">{{ countContent }}</span>
            </button>
            <button
              type="button"
              class="apps-tab-btn"
              :class="{ active: activeCategory === 'cloud' }"
              @click="activeCategory = 'cloud'"
            >
              通讯与云平台 <span class="tab-badge">{{ countCloud }}</span>
            </button>
            <button
              type="button"
              class="apps-tab-btn"
              :class="{ active: activeCategory === 'system' }"
              @click="activeCategory = 'system'"
            >
              调度与基础设施 <span class="tab-badge">{{ countSystem }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 子系统 Bento Grid 网格区域 -->
      <section class="apps-group">
        <header class="apps-group-head">
          <span class="apps-group-bar" aria-hidden="true"></span>
          <h2 class="apps-group-title">已开通子系统</h2>
          <span class="apps-group-count">可用 {{ filteredEntries.length }} / 共 {{ countAll }} 个</span>
        </header>

        <!-- 骨架屏 Loading -->
        <ul v-if="loading" class="apps-grid" aria-hidden="true">
          <li v-for="slot in 8" :key="slot" class="apps-skeleton">
            <div class="apps-skeleton-top">
              <span class="apps-skeleton-num"></span>
              <span class="apps-skeleton-dot"></span>
            </div>
            <div class="apps-skeleton-body">
              <span class="apps-skeleton-plate"></span>
              <div class="apps-skeleton-lines">
                <span class="apps-skeleton-name"></span>
                <span class="apps-skeleton-code"></span>
              </div>
            </div>
            <span class="apps-skeleton-text"></span>
            <div class="apps-skeleton-tags">
              <span class="skeleton-pill"></span>
              <span class="skeleton-pill"></span>
            </div>
          </li>
        </ul>

        <!-- 渲染真实子系统列表 -->
        <ul v-else-if="filteredEntries.length" class="apps-grid">
          <li v-for="(item, index) in filteredEntries" :key="item.subApp">
            <button
              type="button"
              class="apps-card"
              :class="{
                'is-entering': entering === item.subApp,
                'is-pinned': isPinned(item.subApp)
              }"
              :style="{ '--accent': accentOf(index) }"
              :disabled="entering !== ''"
              :aria-label="`进入${item.title}`"
              @mousemove="onCardMouseMove"
              @click="enter(item)"
            >
              <!-- 顶部序号与收藏 Pin -->
              <div class="apps-card-top">
                <span class="apps-card-num">APP {{ pad(index + 1) }}</span>
                <div class="apps-card-actions" @click.stop>
                  <button
                    type="button"
                    class="apps-pin-btn"
                    :class="{ pinned: isPinned(item.subApp) }"
                    :title="isPinned(item.subApp) ? '取消常用置顶' : '设为常用置顶'"
                    @click="togglePin($event, item.subApp)"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </button>
                  <span class="apps-card-arrow" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </span>
                </div>
              </div>

              <!-- 主体图标与信息 -->
              <div class="apps-card-body">
                <div class="apps-card-head-flex">
                  <span class="apps-card-plate">
                    <component
                      :is="useRenderIcon(item.icon)"
                      v-if="item.icon"
                      class="apps-card-icon"
                    />
                    <span v-else class="apps-card-glyph">
                      {{ item.title.slice(0, 1) }}
                    </span>
                  </span>
                  <div class="apps-card-meta">
                    <h3 class="apps-card-name">{{ item.title }}</h3>
                    <span class="apps-card-code">{{ item.code }}</span>
                  </div>
                </div>

                <p class="apps-card-summary">
                  {{ item.summary || "暂无系统描述" }}
                </p>

                <!-- 模块快捷标签 -->
                <div v-if="item.tags && item.tags.length" class="apps-card-tags">
                  <span
                    v-for="tag in item.tags"
                    :key="tag"
                    class="apps-feature-tag"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>

              <!-- 卡片底部状态与进入操作 -->
              <div class="apps-card-footer">
                <div class="apps-state-pill">
                  <span class="state-mini-dot"></span>
                  <span>服务就绪</span>
                </div>
                <span class="apps-enter-label">
                  {{ entering === item.subApp ? "正在进入…" : "进入系统" }}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
              </div>
            </button>
          </li>
        </ul>

        <!-- 搜索无结果 / 空状态 -->
        <div v-else class="apps-empty">
          <div class="apps-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <p class="apps-empty-title">
            {{
              loadError
                ? "子系统列表加载失败"
                : searchQuery
                  ? "未找到匹配的子系统"
                  : "当前账号暂未授权子系统"
            }}
          </p>
          <p class="apps-empty-text">
            {{
              loadError
                ? "请检查网关服务或重新加载。"
                : searchQuery
                  ? "请尝试输入其他关键词，或清空搜索条件。"
                  : "请联系平台管理员为该账号分配相关业务权限。"
            }}
          </p>
          <button
            v-if="loadError"
            type="button"
            class="apps-retry"
            @click="loadEntries"
          >
            重新加载
          </button>
          <button
            v-else-if="searchQuery"
            type="button"
            class="apps-retry"
            @click="searchQuery = ''; activeCategory = 'all'"
          >
            清空筛选条件
          </button>
        </div>
      </section>
    </main>

    <!-- 交互式进入系统转场模态框 -->
    <div
      class="apps-launch-overlay"
      :class="{ active: launchModalVisible }"
      @click.self="closeLaunchModal"
    >
      <div v-if="launchTarget" class="apps-launch-modal">
        <div class="launch-icon-box">
          <div class="launch-spinner"></div>
          <component
            :is="useRenderIcon(launchTarget.icon)"
            v-if="launchTarget.icon"
            class="launch-modal-icon"
          />
          <span v-else class="launch-modal-glyph">{{ launchTarget.title.slice(0, 1) }}</span>
        </div>

        <h3 class="launch-modal-title">正在载入子系统</h3>
        <div class="launch-modal-sub">{{ launchTarget.title }} ({{ launchTarget.code }})</div>
        <p class="launch-modal-desc">{{ launchStatusText }}</p>

        <!-- 进度条 -->
        <div class="launch-progress-track">
          <div class="launch-progress-bar" :style="{ width: `${launchProgress}%` }"></div>
        </div>

        <div class="launch-modal-actions">
          <button type="button" class="launch-btn-cancel" @click="closeLaunchModal">
            取消进入
          </button>
          <button type="button" class="launch-btn-fast" @click="confirmFastEnter">
            加速进入
          </button>
        </div>
      </div>
    </div>

    <!-- 提示消息气泡 Toast -->
    <div class="apps-toast" :class="{ show: toastVisible }">
      <span class="apps-toast-icon">✨</span>
      <span>{{ toastText }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ==========================================================================
   CSS 变量与主题定义
   ========================================================================== */
.apps-page {
  /* 基础中性色调 (Dark 默认) */
  --lb-bg: #090d16;
  --lb-surface: rgba(18, 25, 41, 0.75);
  --lb-surface-hover: rgba(28, 38, 62, 0.88);
  --lb-elevated: #162034;
  --lb-line: rgba(255, 255, 255, 0.08);
  --lb-line-strong: rgba(255, 255, 255, 0.16);
  --lb-ink: #f1f5f9;
  --lb-muted: #94a3b8;
  --lb-faint: #64748b;
  --lb-tint-base: #111827;
  --lb-shadow: rgba(0, 0, 0, 0.45);
  --lb-accent-glow: rgba(59, 130, 246, 0.25);
  --lb-input-bg: rgba(15, 23, 42, 0.65);
  --lb-badge-bg: rgba(255, 255, 255, 0.06);
  --lb-badge-border: rgba(255, 255, 255, 0.12);
  --lb-tag-hover: rgba(255, 255, 255, 0.14);
  --lb-mono: ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Consolas, monospace;

  position: relative;
  box-sizing: border-box;
  min-height: 100vh;
  color: var(--lb-ink);
  background-color: var(--lb-bg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-x: hidden;
}

/* Light 模式适配 */
.apps-page.theme-light,
html:not(.dark) .apps-page {
  --lb-bg: #f4f6fb;
  --lb-surface: rgba(255, 255, 255, 0.88);
  --lb-surface-hover: #ffffff;
  --lb-elevated: #ffffff;
  --lb-line: rgba(226, 232, 240, 0.9);
  --lb-line-strong: rgba(203, 213, 225, 0.95);
  --lb-ink: #0f172a;
  --lb-muted: #475569;
  --lb-faint: #94a3b8;
  --lb-tint-base: #ffffff;
  --lb-shadow: rgba(15, 23, 42, 0.08);
  --lb-accent-glow: rgba(37, 99, 235, 0.18);
  --lb-input-bg: rgba(255, 255, 255, 0.92);
  --lb-badge-bg: rgba(241, 245, 249, 0.85);
  --lb-badge-border: rgba(203, 213, 225, 0.8);
  --lb-tag-hover: rgba(226, 232, 240, 0.95);
}

/* 背景光效与微网格层 */
.ambient-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.ambient-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.08) 1px, transparent 0);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse at 50% 30%, #000 20%, transparent 80%);
  opacity: 0.85;
}

.theme-light .ambient-grid {
  background-image: radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.06) 1px, transparent 0);
}

.ambient-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.glow-1 {
  top: -160px;
  left: 50%;
  transform: translateX(-50%);
  width: 720px;
  height: 440px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(99, 102, 241, 0.08) 45%, transparent 70%);
  filter: blur(65px);
}

.glow-2 {
  bottom: -100px;
  right: 5%;
  width: 520px;
  height: 360px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
  filter: blur(75px);
}

/* ---------- 顶栏 ---------- */
.apps-top {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  box-sizing: border-box;
  height: 64px;
  padding: 0 32px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: color-mix(in srgb, var(--lb-bg) 80%, transparent);
  border-bottom: 1px solid var(--lb-line);
}

.apps-brand {
  display: flex;
  align-items: center;
  gap: 13px;
}

.apps-mark {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: repeat(2, 5px);
  gap: 3px;
  padding: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  border-radius: 9px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

.apps-mark-dot {
  width: 5px;
  height: 5px;
  background: #ffffff;
  border-radius: 1px;
}

.apps-mark-dot:nth-child(2),
.apps-mark-dot:nth-child(3) {
  opacity: 0.5;
}

.apps-brand-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.apps-brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--lb-ink);
}

.apps-brand-badge {
  font-size: 10px;
  font-family: var(--lb-mono);
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.25);
  letter-spacing: 0.06em;
}

.apps-top-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* 集群健康度 */
.apps-status-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  border-radius: 20px;
  background: var(--lb-badge-bg);
  border: 1px solid var(--lb-badge-border);
  font-size: 12px;
  color: var(--lb-muted);
}

.status-pulse {
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
}

.status-pulse::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: #10b981;
  opacity: 0.4;
  animation: pulse-ring 2s infinite ease-in-out;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.7); opacity: 0; }
}

.apps-clock {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--lb-mono);
  font-size: 12px;
  color: var(--lb-muted);
}

.apps-clock-time {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--lb-ink);
  font-variant-numeric: tabular-nums;
}

.apps-divider {
  width: 1px;
  height: 18px;
  background: var(--lb-line);
}

.apps-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--lb-badge-bg);
  border: 1px solid var(--lb-badge-border);
  color: var(--lb-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.apps-icon-btn:hover {
  background: var(--lb-surface-hover);
  color: var(--lb-ink);
  transform: translateY(-1px);
}

.apps-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 5px;
  border-radius: 24px;
  background: var(--lb-badge-bg);
  border: 1px solid var(--lb-badge-border);
  cursor: default;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  font-size: 11px;
  font-weight: bold;
  color: #ffffff;
}

.apps-who {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--lb-ink);
  max-width: 10em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.apps-logout {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--lb-muted);
  background: var(--lb-badge-bg);
  border: 1px solid var(--lb-badge-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.apps-logout:hover {
  background: var(--lb-surface-hover);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

/* ---------- 主体布局 ---------- */
.apps-main {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  max-width: 1240px;
  margin: 0 auto;
  padding: 40px 28px 80px;
}

.apps-hero {
  text-align: center;
  margin-bottom: 38px;
}

.apps-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 14px;
  margin: 0 0 16px;
  font-family: var(--lb-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.22);
  border-radius: 999px;
}

.apps-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 8px #3b82f6;
}

.apps-hero-title {
  margin: 0 0 12px;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  background: linear-gradient(180deg, var(--lb-ink) 30%, color-mix(in srgb, var(--lb-ink) 65%, #3b82f6) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.apps-hero-lead {
  margin: 0 auto;
  max-width: 620px;
  font-size: 14.5px;
  color: var(--lb-muted);
  line-height: 1.65;
}

/* 快速搜索栏与分类 */
.apps-command-bar {
  max-width: 760px;
  margin: 30px auto 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.apps-search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.apps-search-icon {
  position: absolute;
  left: 18px;
  color: var(--lb-faint);
  pointer-events: none;
}

.apps-search-input {
  width: 100%;
  height: 50px;
  padding: 0 100px 0 48px;
  font-size: 14.5px;
  font-family: inherit;
  color: var(--lb-ink);
  background: var(--lb-input-bg);
  border: 1px solid var(--lb-line);
  border-radius: 14px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  outline: none;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.apps-search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px var(--lb-accent-glow), 0 8px 30px rgba(0, 0, 0, 0.15);
  background: var(--lb-surface-hover);
}

.apps-search-input::placeholder {
  color: var(--lb-faint);
}

.apps-shortcut-tag {
  position: absolute;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--lb-badge-bg);
  border: 1px solid var(--lb-badge-border);
  color: var(--lb-faint);
  font-size: 11px;
  font-family: var(--lb-mono);
  pointer-events: none;
}

.apps-filter-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.apps-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--lb-muted);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.apps-tab-btn:hover {
  color: var(--lb-ink);
  background: var(--lb-badge-bg);
}

.apps-tab-btn.active {
  color: #ffffff;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35);
}

.tab-badge {
  font-size: 11px;
  font-family: var(--lb-mono);
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
}

/* ---------- 分组头部 ---------- */
.apps-group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lb-line);
}

.apps-group-bar {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: #3b82f6;
}

.apps-group-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--lb-ink);
}

.apps-group-count {
  margin-left: auto;
  font-family: var(--lb-mono);
  font-size: 12px;
  color: var(--lb-faint);
}

/* ---------- Bento Grid 卡片 ---------- */
.apps-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 1180px) {
  .apps-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 860px) {
  .apps-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .apps-grid {
    grid-template-columns: 1fr;
  }
}

.apps-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 200px;
  padding: 20px 18px 16px;
  overflow: hidden;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--lb-surface);
  border: 1px solid var(--lb-line);
  border-radius: 16px;
  box-shadow: 0 10px 30px -10px var(--lb-shadow);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.25s ease,
              box-shadow 0.25s ease,
              background-color 0.25s ease;
}

/* 鼠标跟随聚光灯效果 */
.apps-card::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 16px;
  padding: 1px;
  background: radial-gradient(
    360px circle at var(--mouse-x, -100px) var(--mouse-y, -100px),
    var(--accent),
    transparent 60%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 2;
}

.apps-card:hover:not(:disabled) {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--lb-line));
  box-shadow: 0 16px 36px -12px var(--lb-shadow), 0 0 20px -6px color-mix(in srgb, var(--accent) 30%, transparent);
  background: var(--lb-surface-hover);
}

.apps-card:hover:not(:disabled)::before {
  opacity: 0.9;
}

.apps-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.apps-card-num {
  font-family: var(--lb-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  padding: 2px 7px;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

.apps-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.apps-pin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: var(--lb-faint);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s;
}

.apps-pin-btn:hover {
  color: #eab308;
  transform: scale(1.15);
}

.apps-pin-btn.pinned {
  color: #eab308;
}

.apps-card-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lb-faint);
  transition: transform 0.2s ease, color 0.2s ease;
}

.apps-card:hover:not(:disabled) .apps-card-arrow {
  color: var(--accent);
  transform: translate(2px, -2px);
}

/* 卡片内容区 */
.apps-card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.apps-card-head-flex {
  display: flex;
  align-items: center;
  gap: 12px;
}

.apps-card-plate {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--lb-tint-base));
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.apps-card:hover:not(:disabled) .apps-card-plate {
  transform: scale(1.08) rotate(3deg);
}

.apps-card-icon {
  width: 22px;
  height: 22px;
}

.apps-card-glyph {
  font-size: 16px;
  font-weight: 700;
}

.apps-card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.apps-card-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--lb-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}

.apps-card:hover:not(:disabled) .apps-card-name {
  color: var(--accent);
}

.apps-card-code {
  font-family: var(--lb-mono);
  font-size: 11px;
  color: var(--lb-faint);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.apps-card-summary {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 38px;
  font-size: 12.5px;
  color: var(--lb-muted);
  line-height: 1.55;
}

.apps-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.apps-feature-tag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 5px;
  color: var(--lb-muted);
  background: var(--lb-badge-bg);
  border: 1px solid var(--lb-badge-border);
  transition: all 0.15s;
}

.apps-feature-tag:hover {
  background: var(--lb-tag-hover);
  color: var(--lb-ink);
}

/* 卡片底部 */
.apps-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  margin-top: auto;
  border-top: 1px solid var(--lb-line);
}

.apps-state-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--lb-mono);
  font-size: 11px;
  color: var(--lb-faint);
}

.state-mini-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
}

.apps-enter-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--lb-muted);
  transition: color 0.15s, gap 0.15s;
}

.apps-card:hover:not(:disabled) .apps-enter-label {
  color: var(--accent);
  gap: 7px;
}

/* ---------- 骨架屏 Skeleton ---------- */
.apps-skeleton {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  min-height: 200px;
  padding: 20px 18px 16px;
  background: var(--lb-surface);
  border: 1px solid var(--lb-line);
  border-radius: 16px;
}

.apps-skeleton-top {
  display: flex;
  justify-content: space-between;
}

.apps-skeleton-num,
.apps-skeleton-dot,
.apps-skeleton-plate,
.apps-skeleton-name,
.apps-skeleton-code,
.apps-skeleton-text,
.skeleton-pill {
  background: color-mix(in srgb, var(--lb-line-strong) 40%, var(--lb-surface));
  border-radius: 6px;
  animation: apps-pulse 1.6s ease-in-out infinite;
}

.apps-skeleton-num { width: 38px; height: 16px; }
.apps-skeleton-dot { width: 18px; height: 18px; border-radius: 50%; }
.apps-skeleton-body { display: flex; gap: 12px; }
.apps-skeleton-plate { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; }
.apps-skeleton-lines { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.apps-skeleton-name { width: 60%; height: 16px; }
.apps-skeleton-code { width: 40%; height: 12px; }
.apps-skeleton-text { width: 90%; height: 26px; }
.apps-skeleton-tags { display: flex; gap: 6px; }
.skeleton-pill { width: 50px; height: 18px; }

@keyframes apps-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.9; }
}

/* ---------- 空状态 Empty State ---------- */
.apps-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 20px;
  text-align: center;
  background: var(--lb-surface);
  border: 1px dashed var(--lb-line-strong);
  border-radius: 16px;
}

.apps-empty-icon {
  color: var(--lb-faint);
  margin-bottom: 6px;
}

.apps-empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--lb-ink);
}

.apps-empty-text {
  margin: 0;
  font-size: 13px;
  color: var(--lb-muted);
  max-width: 420px;
  line-height: 1.6;
}

.apps-retry {
  margin-top: 10px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transition: transform 0.15s, filter 0.15s;
}

.apps-retry:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
}

/* ---------- 转场模态框 Launch Overlay ---------- */
.apps-launch-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(4, 7, 14, 0.72);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.apps-launch-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.apps-launch-modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: 32px 28px;
  text-align: center;
  background: var(--lb-elevated);
  border: 1px solid var(--lb-line-strong);
  border-radius: 20px;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6);
  transform: scale(0.94) translateY(12px);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.apps-launch-overlay.active .apps-launch-modal {
  transform: scale(1) translateY(0);
}

.launch-icon-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 18px;
  border-radius: 18px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.launch-spinner {
  position: absolute;
  inset: -4px;
  border: 2px solid transparent;
  border-top-color: #3b82f6;
  border-right-color: #3b82f6;
  border-radius: 22px;
  animation: launch-spin 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
}

@keyframes launch-spin {
  100% { transform: rotate(360deg); }
}

.launch-modal-icon { width: 30px; height: 30px; }
.launch-modal-glyph { font-size: 24px; font-weight: 700; }

.launch-modal-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: var(--lb-ink);
}

.launch-modal-sub {
  font-size: 13.5px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 12px;
}

.launch-modal-desc {
  margin: 0 0 22px;
  font-size: 13px;
  color: var(--lb-muted);
  line-height: 1.6;
  min-height: 40px;
}

.launch-progress-track {
  width: 100%;
  height: 6px;
  background: var(--lb-badge-bg);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 22px;
}

.launch-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 4px;
  transition: width 0.25s ease;
}

.launch-modal-actions {
  display: flex;
  gap: 12px;
}

.launch-btn-cancel,
.launch-btn-fast {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13.5px;
  cursor: pointer;
  transition: all 0.2s;
}

.launch-btn-cancel {
  border: 1px solid var(--lb-line);
  background: var(--lb-badge-bg);
  color: var(--lb-muted);
}

.launch-btn-cancel:hover {
  background: var(--lb-surface-hover);
  color: var(--lb-ink);
}

.launch-btn-fast {
  border: none;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}

.launch-btn-fast:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
}

/* ---------- Toast 提示 ---------- */
.apps-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 101;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  background: var(--lb-elevated);
  border: 1px solid var(--lb-line-strong);
  color: var(--lb-ink);
  font-size: 13px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  transform: translateY(80px);
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.apps-toast.show {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.apps-toast-icon {
  font-size: 14px;
}
</style>
