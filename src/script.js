// ==================== 智能表格模块 ====================
// 使用命名空间封装智能表格的所有变量和函数，避免与其他模块冲突
const SmartTableModule = {
    // 全局变量
    rowCount: 0,
    selectedRows: new Set(),
    lastClickedRowId: null,

    // 跟踪每一行的提取状态
    EXTRACT_STATUS: {
        IDLE: 'idle',
        EXTRACTING: 'extracting',
        COMPLETED: 'completed',
        ERROR: 'error'
    },
    rowExtractStatus: new Map(), // rowId -> status

    // 跟踪每一行的提示词生成状态
    promptGeneratingRows: new Set(),

    // 跟踪每一行的测试生成状态
    rowTestGeneratedStatus: new Set(), // 存储已经测试过的rowId

    // 跟踪提示词模式选择
    currentPromptModeRow: null,
    currentPromptModeType: null,

    // 分组管理
    rowGroups: new Map(), // groupId -> [rowId1, rowId2, ...]
    rowToGroup: new Map(), // rowId -> groupId
    groupIdCounter: 0, // 用于生成唯一的组ID
    groupExpandedState: new Map(), // groupId -> boolean (是否展开)
    groupSelectionStart: null, // Shift+点击选择的起始行
    groupSelectionEnd: null, // Shift+点击选择的结束行
    dragSourceRowId: null, // 拖拽源行ID
    groupColorIndex: new Map(), // groupId -> colorIndex (固定每个组的颜色索引)
    nextColorIndex: 0 // 下一个可用的颜色索引
};

// 为了保持向后兼容，创建全局变量的引用
let rowCount = SmartTableModule.rowCount;
let selectedRows = SmartTableModule.selectedRows;
let lastClickedRowId = SmartTableModule.lastClickedRowId;
const EXTRACT_STATUS = SmartTableModule.EXTRACT_STATUS;
let rowExtractStatus = SmartTableModule.rowExtractStatus;
let promptGeneratingRows = SmartTableModule.promptGeneratingRows;
let rowTestGeneratedStatus = SmartTableModule.rowTestGeneratedStatus;
let currentPromptModeRow = SmartTableModule.currentPromptModeRow;
let currentPromptModeType = SmartTableModule.currentPromptModeType;
let rowGroups = SmartTableModule.rowGroups;
let rowToGroup = SmartTableModule.rowToGroup;
let groupIdCounter = SmartTableModule.groupIdCounter;
let groupExpandedState = SmartTableModule.groupExpandedState;
let groupSelectionStart = SmartTableModule.groupSelectionStart;
let groupSelectionEnd = SmartTableModule.groupSelectionEnd;
let dragSourceRowId = SmartTableModule.dragSourceRowId;
let groupColorIndex = SmartTableModule.groupColorIndex;
let nextColorIndex = SmartTableModule.nextColorIndex;

// 组颜色配置
const GROUP_COLORS = [
    { main: '#2196F3', light: '#BBDEFB', lighter: '#E3F2FD' }, // 蓝色 - 加深
    { main: '#4CAF50', light: '#A5D6A7', lighter: '#C8E6C9' }, // 绿色 - 加深
    { main: '#FF9800', light: '#FFCC80', lighter: '#FFE0B2' }, // 橙色 - 加深
    { main: '#9C27B0', light: '#CE93D8', lighter: '#E1BEE7' }, // 紫色 - 加深
    { main: '#F44336', light: '#EF9A9A', lighter: '#FFCDD2' }, // 红色 - 加深
    { main: '#00BCD4', light: '#80DEEA', lighter: '#B2EBF2' }, // 青色 - 加深
    { main: '#E91E63', light: '#F48FB1', lighter: '#F8BBD0' }, // 粉色 - 加深
    { main: '#795548', light: '#BCAAA4', lighter: '#D7CCC8' }  // 棕色 - 加深
];

// 获取组的颜色
function getGroupColor(groupId) {
    const index = groupColorIndex.get(groupId);
    return GROUP_COLORS[index % GROUP_COLORS.length];
}

// ==================== 图片缓存管理 ====================

// 图片数据直接用 base64 展示，无需服务端缓存
async function saveImageToCache(imageData) {
    return imageData;
}

// 页面卸载前清除缓存（可选）
window.addEventListener('beforeunload', (e) => {
    // 显示确认对话框
    e.preventDefault();
    e.returnValue = ''; // Chrome需要设置returnValue
    return ''; // 其他浏览器
});

// ==================== 图片缓存管理结束 ====================


const sizePresets = [
    '1:1',
    '21:9',
    '16:9',
    '4:3',
    '3:2',
    '2:3',
    '3:4',
    '9:16',
    '9:21',
    '自定义'
];

const geminiSizePresets = [
    '1:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9'
];

const RESOLUTION_OPTIONS = [
    { label: '1K', size: '1024x1024' },
    { label: '2K', size: '2048x2048' },
    { label: '4K', size: '2880x2880' }
];

function getSelectedResolution(row) {
    const select = row.querySelector('.resolution-select');
    if (!select || select.disabled) return null;
    return select.value;
}

function getResolutionSize(resolution) {
    const opt = RESOLUTION_OPTIONS.find(r => r.label === resolution);
    return opt ? opt.size : '1024x1024';
}

const promptPresets = [
    '主图',
    'A+',
    '详情页',
    '场景图',
    '白底图',
    '自定义'
];

// AI设置相关
const AI_SETTINGS_KEY = 'aiSettings';
const TABLE_DATA_KEY = 'smartTableData';
const GROUP_DATA_KEY = 'smartTableGroups';
const WATERMARK_IMAGE_KEY = 'watermarkImage';
let saveDataTimer = null;

const DEFAULT_APLUS_TEMPLATE = `这是一个 {product_name}，根据：

{extract_result}

制作一套亚马逊超级A+图片提示词（共8张）

【整体风格要求】
画面风格：简洁专业、高端大气，符合亚马逊电商平台调性
背景：纯白色或浅色渐变背景，突出产品主体
光线：柔和自然光，避免强烈阴影
色调：明亮清晰，色彩真实还原
景深：背景适度虚化，保持产品和文字清晰
【字体和文字要求】
字体：现代无衬线字体（Arial, Helvetica, Roboto）
主标题颜色：深色系 #2C3E50 或品牌色
副标题颜色：中性灰 #7F8C8D
强调文字颜色：蓝色 #3498DB 或绿色 #27AE60
排版：清晰层次，左对齐或居中，行距适中
语言：全部英文
文字必须出现在画面中清晰可见，大小适中，避免被背景或产品遮挡
【图片类型与文字要求】
主图
产品正面展示，纯白背景
可加入品牌标识或简短主标题（如 "Premium Quality {product_name}"）
生活方式图 ×2
展示产品使用场景
必须包含英文文字说明
文字内容简洁有力，例如：
主标题："Perfect for Daily Use"
副标题："Enhances your home and office experience"
文字应自然融入画面，不遮挡产品
卖点图
突出核心卖点
配图标和文字说明
文字示例："Durable Material", "Ergonomic Design", "Easy to Clean"
场景图 ×2
展示不同使用环境
必须包含英文文字标注
文字说明产品特点或优势，如："Versatile Design", "Compact & Lightweight"
字体大小和颜色与背景对比明显，确保可读性
对比图
展示产品优势
可加入文字描述比较（如 "Better Than Competitors"）
材质工艺图
细节特写
文字可标注材质或工艺特征（如 "High-Quality Stainless Steel"）`;

let aiSettings = {
    // 图像识别API
    imageApiBaseUrl: 'https://ai.comfly.org',
    imageApiKey: '',
    imageModelName: 'gpt-5.2',
    imagePromptTemplate: `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息和图片内容，按照以下格式提取和补充内容。

重要：
1. 仔细观察商品图片，分析商品的外观特点、颜色、设计细节等视觉特征
2. 结合用户提供的卖点信息进行补充和完善
3. 直接输出格式化结果，不要添加任何额外说明

一、商品名称 (Product Name)
中文：
商品英文名：

二、商品特征 (Product Features)
请详细描述商品的外观特点，包括但不限于：
- 颜色：主色调、配色方案
- 设计：造型特点、图案、装饰元素
- 尺寸：大小、比例
- 工艺：缝制、印刷、表面处理等细节
- 其他显著特征

中文：
English：

三、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

四、材质信息 (Material Information)
中文：
English：

五、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`,

    // 文本分析API
    textApiBaseUrl: 'https://api.deepseek.com',
    textApiKey: '',
    textModelName: 'deepseek-chat',
    textPromptTemplate: `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息，按照以下格式提取和补充内容。

重要：直接输出格式化结果，不要添加任何额外说明。

一、商品名称 (Product Name)
中文：
商品英文名：

二、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

三、材质信息 (Material Information)
中文：
English：

四、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`,

    // 主图模板
    mainImageTemplate: `这是一个{product_name}，根据：

{extract_result}

制作一套亚马逊主图提示词（共12张），图片比例为1:1。

【整体风格要求】
- 画面风格：专业高端、简洁大气，符合亚马逊主图规范
- 背景：纯白色背景（主图必须），场景图可用简约背景
- 光线：柔和均匀，突出产品细节
- 色调：明亮清晰，色彩真实
- 构图：产品居中，占画面70-80%
- 景深控制：背景适度虚化即可，避免过度模糊产生波浪效果，保持画面自然清晰

【字体风格统一要求】
- 字体：统一使用现代无衬线字体（Arial, Helvetica, Roboto）
- 主标题颜色：深色系 #2C3E50 或品牌色（字号最大）
- 副标题颜色：中性灰 #7F8C8D（字号中等）
- 强调文字颜色：蓝色 #3498DB 或绿色 #27AE60（用于突出卖点）
- 排版：保持一致的对齐方式和行距
- 语言：全部使用英文

【图片类型】
1. 主图：纯白背景，产品正面完整展示
2. 生活方式图×3：真实使用场景，展现产品应用，**必须包含英文文字说明**
3. 卖点图×2：突出1-3个核心卖点，配图标和文字
4. 卖点汇总图：集中展示所有主要卖点
5. 场景图×2：不同使用环境或角度，**必须包含英文文字标注**
6. 对比图：展示产品优势（与竞品或使用前后对比）
7. 材质工艺图：特写镜头展现材质和工艺细节
8. 尺寸图：标注产品尺寸，配参照物

**重要提示**：生活方式图和场景图必须在画面中清晰显示英文文字，文字内容要简洁有力，突出产品使用场景或核心优势。

请为每张图片生成详细的英文提示词，确保字体风格在所有图片中保持统一。`,

    // A+模板
    aplusTemplate: DEFAULT_APLUS_TEMPLATE,

    // 图片生成API
    imageGenApiBaseUrl: 'https://ai.comfly.org',
    imageGenApiKey: '',
    imageGenModelName: 'gpt-image-2',

    // Gemini图片生成API
    geminiApiBaseUrl: 'https://ai.comfly.org',
    geminiApiKey: '',

    // 下载路径设置
    downloadPath: ''
};

// 下载目录句柄（用于File System Access API）
let downloadDirHandle = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 添加行按钮事件
    document.getElementById('addRowBtn').addEventListener('click', addRow);

    // 工具栏按钮事件
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedRows);
    document.getElementById('cancelSelectBtn').addEventListener('click', cancelSelection);
    document.getElementById('batchExtractBtn').addEventListener('click', batchExtract);

    // 设置窗口事件
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('clearSettingsBtn').addEventListener('click', clearSettings);
    document.getElementById('selectDownloadPathBtn').addEventListener('click', selectDownloadPath);

    // 顶部工具栏设置按钮事件
    document.getElementById('topSettingsBtn').addEventListener('click', openSettings);

    // 导航栏切换事件
    const navBtns = document.querySelectorAll('.settings-nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchSettingsTab(tab);
        });
    });

    // 点击模态框背景关闭
    document.getElementById('settingsModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeSettings();
        }
    });

    // 刷新页面恢复初始状态（不恢复上次的表格/分组数据）
    localStorage.removeItem(TABLE_DATA_KEY);
    localStorage.removeItem(GROUP_DATA_KEY);
    for (let i = 0; i < 6; i++) {
        addRow();
    }

    // 加载AI设置
    loadAISettings();

    // 提取结果编辑弹窗事件
    document.getElementById('closeExtractEditBtn').addEventListener('click', closeExtractEditModal);
    document.getElementById('modifyTextBtn').addEventListener('click', modifyTextWithAI);
    document.getElementById('extractEditModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeExtractEditModal();
        }
    });

    // 分析按钮事件
    document.getElementById('analyzeSizeBtn').addEventListener('click', analyzeSizeWithAI);
    document.getElementById('analyzeWearingBtn').addEventListener('click', analyzeWearingWithAI);
    document.getElementById('analyzeUsageBtn').addEventListener('click', analyzeUsageWithAI);

    // 提示词编辑弹窗事件
    document.getElementById('closeFreePromptBtn').addEventListener('click', closePromptEditModal);
    document.getElementById('freePromptModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closePromptEditModal();
        }
    });
    // 自动保存：输入即存
    document.getElementById('freePromptTextarea').addEventListener('input', function() {
        autoSavePromptEdit();
    });
    // 预设管理事件
    document.getElementById('openPresetSettingsBtn').addEventListener('click', openPresetSettingsModal);
    document.getElementById('closePresetSettingsBtn').addEventListener('click', closePresetSettingsModal);
    document.getElementById('presetSettingsModal').addEventListener('click', function(e) {
        if (e.target === this) closePresetSettingsModal();
    });
    document.getElementById('addNewPresetBtn').addEventListener('click', () => openPresetEditSubModal(null));
    document.getElementById('closePresetEditSubBtn').addEventListener('click', closePresetEditSubModal);
    document.getElementById('cancelPresetEditBtn').addEventListener('click', closePresetEditSubModal);
    document.getElementById('savePresetEditBtn').addEventListener('click', savePresetEdit);
    // 加载预设列表
    renderPresets();

    // 批量导入提示词弹窗事件
    document.getElementById('closeBatchPromptBtn').addEventListener('click', closeBatchPromptModal);
    document.getElementById('cancelBatchPromptBtn').addEventListener('click', closeBatchPromptModal);
    document.getElementById('confirmBatchPromptBtn').addEventListener('click', confirmBatchPrompt);
    document.getElementById('batchPromptModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeBatchPromptModal();
        }
    });

    // 快捷提示词设置弹窗事件
    document.getElementById('openQuickTemplateSettingsBtn').addEventListener('click', showQuickTemplateSettingsModal);
    document.getElementById('closeQuickTemplateSettingsBtn').addEventListener('click', closeQuickTemplateSettingsModal);
    document.getElementById('saveQuickTemplateSettingsBtn').addEventListener('click', saveQuickTemplateSettings);
    document.getElementById('addTemplateBtn').addEventListener('click', showAddTemplateModal);
    document.getElementById('quickTemplateSettingsModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeQuickTemplateSettingsModal();
        }
    });

    // 添加新预设弹窗事件
    document.getElementById('closeAddTemplateBtn').addEventListener('click', closeAddTemplateModal);
    document.getElementById('cancelAddTemplateBtn').addEventListener('click', closeAddTemplateModal);
    document.getElementById('confirmAddTemplateBtn').addEventListener('click', confirmAddTemplate);
    document.getElementById('addTemplateModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddTemplateModal();
        }
    });

    // ==================== 分组右键菜单事件 ====================
    // 监听右键点击序号单元格
    document.addEventListener('contextmenu', function(e) {
        const cell = e.target.closest('.row-number-cell');
        if (!cell) return;

        const rowId = parseInt(cell.dataset.row);
        const groupId = rowToGroup.get(rowId);

        if (!groupId) return; // 不是分组行，不显示菜单

        e.preventDefault();
        showGroupContextMenu(e.pageX, e.pageY, rowId, groupId);
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', function() {
        hideGroupContextMenu();
    });

    // ==================== 批量导入功能 ====================
    setupBatchImportFeature();

    // ==================== 水印功能 ====================
    initWatermarkFeature();

    // ==================== 拆分功能 ====================
    initSplitFeature();

    // ==================== 模块切换功能 ====================
    initModuleSwitcher();

    VisualAgentModule.init();
});

// 批量导入功能初始化
function setupBatchImportFeature() {
    const batchImportInput = document.getElementById('batchImportInput');

    // 处理文件选择
    batchImportInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        const targetRowId = parseInt(this.dataset.targetRowId);

        if (files.length > 0 && targetRowId) {
            handleBatchImport(files, targetRowId);
            // 清空input，允许重复选择相同文件
            e.target.value = '';
            // 清除目标行ID
            delete this.dataset.targetRowId;
        }
    });
}

// 处理批量导入图片
async function handleBatchImport(files, targetRowId) {
    if (files.length === 0) return;

    // 生成新的组ID
    groupIdCounter++;
    const groupId = groupIdCounter;

    // 为这个组分配颜色索引
    groupColorIndex.set(groupId, nextColorIndex);
    nextColorIndex = (nextColorIndex + 1) % GROUP_COLORS.length;

    // 初始化组数据
    rowGroups.set(groupId, []);

    // 临时存储创建的行和rowId
    const createdRows = [];
    const rowIds = [];

    // 为每个文件创建一行
    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // 验证是否为图片文件
        if (!file.type.startsWith('image/')) {
            console.warn(`跳过非图片文件: ${file.name}`);
            continue;
        }

        // 创建新行（先不插入DOM）
        const newRow = addRow(false);
        const rowId = parseInt(newRow.dataset.rowId);

        // 设置组的视觉标识
        newRow.setAttribute('data-group-id', groupId);
        updateRowGroupStyle(newRow, groupId);

        // 存储行和rowId
        createdRows.push({ row: newRow, file: file });
        rowIds.push(rowId);

        // 将rowId映射到组
        rowToGroup.set(rowId, groupId);

        // 读取并设置图片
        const reader = new FileReader();
        reader.onload = function(e) {
            const productUploadArea = newRow.querySelector('.product-upload');
            const productPreview = newRow.querySelector('.product-preview');
            const fileInput = newRow.querySelector('.product-file-input');

            if (productUploadArea && productPreview) {
                productPreview.src = e.target.result;
                productUploadArea.classList.add('has-image');

                // 创建File对象并赋值给input（用于后续可能的操作）
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
            }
        };
        reader.readAsDataURL(file);
    }

    // 将rowIds按正确顺序添加到组（第一个文件对应第一个rowId）
    rowGroups.set(groupId, rowIds);

    // 找到目标行
    const targetRow = document.querySelector(`tr[data-row-id="${targetRowId}"]`);
    if (!targetRow) {
        console.error(`找不到目标行: ${targetRowId}`);
        return;
    }

    // 将所有行插入到目标行下方
    let insertAfter = targetRow;
    for (let i = 0; i < createdRows.length; i++) {
        insertAfter.parentNode.insertBefore(createdRows[i].row, insertAfter.nextSibling);
        insertAfter = createdRows[i].row;
    }

    // 如果成功创建了组，显示提示
    const groupRows = rowGroups.get(groupId);
    if (groupRows && groupRows.length > 0) {
        console.log(`批量导入完成：创建了 ${groupRows.length} 行，组ID: ${groupId}`);

        // 初始化组为展开状态
        groupExpandedState.set(groupId, true);

        // 更新组UI，创建展开按钮
        updateGroupUI(groupId);

        // 可选：滚动到第一行
        const firstRow = document.querySelector(`tr[data-row-id="${groupRows[0]}"]`);
        if (firstRow) {
            firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// 更新行的组样式
function updateRowGroupStyle(row, groupId) {
    const color = getGroupColor(groupId);
    row.style.setProperty('--group-color', color.main);
}

// 监听J键打开设置
document.addEventListener('keydown', function(e) {
    // 检查是否在输入框中
    const isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // J键打开设置
    if ((e.key === 'j' || e.key === 'J') && !isInputField) {
        e.preventDefault();
        openSettings();
    }

    // Ctrl+Shift+G 解散分组
    if ((e.key === 'g' || e.key === 'G') && e.ctrlKey && e.shiftKey && !isInputField) {
        e.preventDefault();

        // 获取当前选中的行（如果有）
        if (groupSelectionStart !== null) {
            const groupId = rowToGroup.get(groupSelectionStart);
            if (groupId) {
                ungroupAll(groupId);

                // 清除选择样式
                document.querySelectorAll('.row-number-cell.group-selection').forEach(cell => {
                    cell.classList.remove('group-selection');
                });
                groupSelectionStart = null;
                groupSelectionEnd = null;

                console.log('分组已解散');
            } else {
                alert('选中的行不在任何分组中');
            }
        } else {
            alert('请先点击一个分组中的序号');
        }
    }
});

// 提取结果编辑弹窗相关
let currentEditingRowId = null;

// 添加新行
function addRow(insertAtTop = false, preferredRowId = null) {
    if (preferredRowId != null) {
        rowCount = Math.max(rowCount, preferredRowId);
    } else {
        rowCount++;
    }
    const newRowId = preferredRowId != null ? preferredRowId : rowCount;
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    row.dataset.rowId = newRowId;

    row.innerHTML = `
        <td class="row-number-cell" data-row="${newRowId}">
            <span class="row-number">${newRowId}</span>
            <button class="delete-btn-hidden" data-row="${newRowId}">删除</button>
        </td>
        <td>
            <div class="product-upload-wrapper">
                <div class="upload-area product-upload" data-row="${newRowId}">
                    <input type="file" accept="image/*" multiple class="product-file-input" data-row="${newRowId}">
                    <div class="upload-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>上传图片</span>
                    </div>
                    <img class="product-preview" alt="预览">
                    <button class="delete-image-btn product-delete-btn" data-row="${newRowId}" style="display:none;">×</button>
                </div>
                <button class="product-gallery-btn" data-row="${newRowId}" style="display:none;">展开</button>
            </div>
        </td>
        <td>
            <div class="selling-point-container">
                <textarea class="selling-point-input" placeholder="输入卖点" data-row="${newRowId}"></textarea>
                <button class="extract-btn" data-row="${newRowId}" style="display:none;">提取</button>
            </div>
        </td>
        <td>
            <div class="extract-display" data-row="${newRowId}" title="点击查看完整内容">未提取</div>
        </td>
        <td>
            <div class="prompt-container" data-row="${newRowId}">
                <button class="prompt-input-btn" data-row="${newRowId}" title="点击手动输入提示词">
                    输入提示词
                </button>
                <div class="prompt-buttons-container" data-row="${newRowId}">
                    <button class="main-image-btn" data-row="${newRowId}" disabled>主图</button>
                    <button class="aplus-btn" data-row="${newRowId}" disabled>A+</button>
                </div>
                <div class="prompt-display" data-row="${newRowId}" title="点击编辑提示词" style="display: none;">未输入</div>
                <div class="prompt-result-container" data-row="${newRowId}"></div>
            </div>
        </td>
        <td>
            <select class="model-select" data-row="${newRowId}" style="width: 100%; margin-bottom: 5px;">
                <option value="gpt-image-2">gpt-image-2</option>
                <option value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview</option>
            </select>
            <select class="size-select" data-row="${newRowId}">
                ${sizePresets.map(size => `<option value="${size}">${size}</option>`).join('')}
            </select>
            <input type="text" class="size-custom" placeholder="自定义尺寸" style="display:none; margin-top:5px;" data-row="${newRowId}">
            <div class="resolution-group" data-row="${newRowId}" style="margin-top:5px;">
                <select class="resolution-select" data-row="${newRowId}">
                    ${RESOLUTION_OPTIONS.map(r => `<option value="${r.label}">${r.label}</option>`).join('')}
                </select>
            </div>
        </td>
        <td>
            <div class="image-display empty" data-row="${newRowId}">
                <span>未生成</span>
            </div>
        </td>
        <td>
            <div class="history-images-container" data-row="${newRowId}">
                <div class="history-thumbnails" data-row="${newRowId}"></div>
                <div class="history-buttons-wrapper">
                    <button class="history-gallery-btn" data-row="${newRowId}" style="display:none;">展开</button>
                    <button class="history-download-btn" data-row="${newRowId}" style="display:none;" title="下载所有历史图片">下载</button>
                </div>
            </div>
        </td>
        <td>
            <button class="test-generate-btn" data-row="${newRowId}" disabled>测试生成</button>
            <button class="generate-btn" data-row="${newRowId}">生成</button>
        </td>
    `;

    // 如果需要插入到顶部，则移动到第一个位置
    if (insertAtTop && tbody.firstChild) {
        tbody.insertBefore(row, tbody.firstChild);
    } else {
        tbody.appendChild(row);
    }

    // 绑定事件
    bindRowEvents(row);

    // 自动滚动到新行
    setTimeout(() => {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    scheduleSaveData();
    return row;
}

// 绑定行事件
function bindRowEvents(row) {
    const rowId = parseInt(row.dataset.rowId);

    // ==================== 分组拖拽功能 ====================
    const rowNumberCell = row.querySelector('.row-number-cell');

    // 设置可拖拽
    rowNumberCell.setAttribute('draggable', 'true');

    // 拖拽开始
    rowNumberCell.addEventListener('dragstart', function(e) {
        dragSourceRowId = parseInt(rowId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', rowId);
        rowNumberCell.classList.add('dragging');
    });

    // 拖拽结束
    rowNumberCell.addEventListener('dragend', function(e) {
        dragSourceRowId = null;
        rowNumberCell.classList.remove('dragging');
        // 移除所有拖拽悬停样式
        document.querySelectorAll('.row-number-cell.drag-over').forEach(cell => {
            cell.classList.remove('drag-over');
        });
    });

    // 拖拽经过
    rowNumberCell.addEventListener('dragover', function(e) {
        if (dragSourceRowId === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        rowNumberCell.classList.add('drag-over');
    });

    // 拖拽离开
    rowNumberCell.addEventListener('dragleave', function(e) {
        rowNumberCell.classList.remove('drag-over');
    });

    // 放下
    rowNumberCell.addEventListener('drop', function(e) {
        e.preventDefault();
        rowNumberCell.classList.remove('drag-over');

        if (dragSourceRowId === null) return;

        const targetRowId = parseInt(rowId);

        // 不能拖到自己身上
        if (dragSourceRowId === targetRowId) return;

        // 检查是否有选中的行（使用 selectedRows）
        if (selectedRows.size > 0 && selectedRows.has(dragSourceRowId)) {
            // 多选拖拽：将所有选中的行合并到目标
            const selectedRowIds = Array.from(selectedRows);
            mergeMultipleRowsToGroup(selectedRowIds, targetRowId);

            // 清除选择
            selectedRows.clear();
            lastClickedRowId = null;
            updateSelectionUI();
        } else {
            // 单个拖拽：检查是否在同一组内
            const sourceGroupId = rowToGroup.get(dragSourceRowId);
            const targetGroupId = rowToGroup.get(targetRowId);

            // 如果源行和目标行在同一个组内，则只调换位置
            if (sourceGroupId && targetGroupId && sourceGroupId === targetGroupId) {
                // 同组内调换位置
                const groupRowIds = rowGroups.get(sourceGroupId);
                const sourceIndex = groupRowIds.indexOf(dragSourceRowId);
                const targetIndex = groupRowIds.indexOf(targetRowId);

                if (sourceIndex !== -1 && targetIndex !== -1) {
                    // 交换数组中的位置
                    [groupRowIds[sourceIndex], groupRowIds[targetIndex]] = [groupRowIds[targetIndex], groupRowIds[sourceIndex]];

                    // 交换DOM中的位置
                    const sourceRow = document.querySelector(`tr[data-row-id="${dragSourceRowId}"]`);
                    const targetRow = document.querySelector(`tr[data-row-id="${targetRowId}"]`);

                    if (sourceRow && targetRow) {
                        const tbody = sourceRow.parentNode;
                        const sourceNextSibling = sourceRow.nextSibling;
                        const targetNextSibling = targetRow.nextSibling;

                        // 如果目标行在源行之前
                        if (targetIndex < sourceIndex) {
                            tbody.insertBefore(sourceRow, targetRow);
                            if (targetNextSibling === sourceRow) {
                                tbody.insertBefore(targetRow, sourceNextSibling);
                            } else {
                                tbody.insertBefore(targetRow, targetNextSibling);
                            }
                        } else {
                            // 如果目标行在源行之后
                            tbody.insertBefore(targetRow, sourceRow);
                            if (sourceNextSibling === targetRow) {
                                tbody.insertBefore(sourceRow, targetNextSibling);
                            } else {
                                tbody.insertBefore(sourceRow, sourceNextSibling);
                            }
                        }
                    }

                    // 更新UI
                    updateGroupUI(sourceGroupId);
                }
            } else {
                // 不在同一组内，执行原有的编组逻辑
                mergeRowsToGroup(dragSourceRowId, targetRowId);
            }
        }

        dragSourceRowId = null;
    });

    // Ctrl+点击多选，Shift+点击范围选择
    rowNumberCell.addEventListener('click', function(e) {
        const currentRowId = parseInt(rowId);

        if (e.ctrlKey || e.metaKey) {
            // Ctrl+点击：切换单个行的选择状态
            e.preventDefault();

            if (rowNumberCell.classList.contains('group-selection')) {
                rowNumberCell.classList.remove('group-selection');
            } else {
                rowNumberCell.classList.add('group-selection');
            }
        } else if (e.shiftKey) {
            // Shift+点击：范围选择
            e.preventDefault();

            if (groupSelectionStart === null) {
                // 第一次点击，设置起始点
                groupSelectionStart = currentRowId;
                rowNumberCell.classList.add('group-selection');
            } else {
                // 第二次点击，选中范围
                const minId = Math.min(groupSelectionStart, currentRowId);
                const maxId = Math.max(groupSelectionStart, currentRowId);

                // 添加范围内所有行的选择样式
                for (let i = minId; i <= maxId; i++) {
                    const cell = document.querySelector(`.row-number-cell[data-row="${i}"]`);
                    if (cell) {
                        cell.classList.add('group-selection');
                    }
                }

                // 重置起始点，以便下次Shift+点击可以继续选择
                groupSelectionStart = currentRowId;
            }
        } else {
            // 普通点击，清除所有选择
            groupSelectionStart = null;
            groupSelectionEnd = null;
            document.querySelectorAll('.row-number-cell.group-selection').forEach(cell => {
                cell.classList.remove('group-selection');
            });
        }
    });

    // 商品图片上传（B列）- 支持多图片（最多8张）
    const productUploadArea = row.querySelector('.product-upload');
    const productFileInput = row.querySelector('.product-file-input');
    const productPreview = row.querySelector('.product-preview');
    const productDeleteBtn = row.querySelector('.product-delete-btn');
    const productGalleryBtn = row.querySelector('.product-gallery-btn');

    // 初始化商品图片数组
    if (!row.productImages) {
        row.productImages = [];
    }

    // 阻止文件选择框的点击事件冒泡，避免触发全局关闭画廊
    productFileInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    productUploadArea.addEventListener('click', function(e) {
        // 如果是文件选择框触发的点击，不处理
        if (e.target === productFileInput) return;

        // 如果已有图片，则放大查看；否则打开文件选择
        if (productUploadArea.classList.contains('has-image') && productPreview.src) {
            showImageModal(productPreview.src);
        } else {
            productFileInput.click();
        }
    });

    productFileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // 限制最多8张
            const remainingSlots = 8 - row.productImages.length;
            const filesToAdd = files.slice(0, remainingSlots);

            if (files.length > remainingSlots) {
                alert(`最多只能上传8张商品图，已自动选择前${remainingSlots}张`);
            }

            let pendingReads = filesToAdd.length;
            filesToAdd.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        row.productImages.push(e.target.result);
                        // 显示第一张图片
                        productPreview.src = row.productImages[0];
                        productUploadArea.classList.add('has-image');
                        // 显示删除按钮
                        productDeleteBtn.style.display = 'block';
                        // 显示展开按钮（有图片就显示）
                        if (row.productImages.length >= 1) {
                            productGalleryBtn.style.display = 'inline-block';
                            productGalleryBtn.textContent = `展开 (${row.productImages.length}张)`;
                        }
                        // 所有文件读取完成后刷新画廊
                        pendingReads--;
                        if (pendingReads === 0) {
                            const isExpanded = productGalleryBtn.classList.contains('expanded');
                            if (isExpanded) {
                                toggleProductGallery(row);
                                setTimeout(() => toggleProductGallery(row), 0);
                            }
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    pendingReads--;
                }
            });
        }
    });

    productDeleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        // 删除第一张图片
        if (row.productImages.length > 0) {
            row.productImages.shift();

            if (row.productImages.length > 0) {
                // 还有图片，显示下一张
                productPreview.src = row.productImages[0];
                // 更新展开按钮
                if (row.productImages.length >= 1) {
                    productGalleryBtn.style.display = 'inline-block';
                    productGalleryBtn.textContent = `展开 (${row.productImages.length}张)`;
                }
            } else {
                // 没有图片了
                productPreview.src = '';
                productUploadArea.classList.remove('has-image');
                productDeleteBtn.style.display = 'none';
                productGalleryBtn.style.display = 'none';
            }
        }
        productFileInput.value = '';
    });

    // 商品图展开按钮点击事件
    productGalleryBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleProductGallery(row);
    });

    // 历史图片（H列）- 支持多图片
    const historyGalleryBtn = row.querySelector('.history-gallery-btn');
    const historyDownloadBtn = row.querySelector('.history-download-btn');

    // 存储该行的所有历史图片
    if (!row.historyImages) {
        row.historyImages = [];
    }

    // 历史图片展开按钮点击事件
    historyGalleryBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleHistoryGallery(row);
    });

    // 历史图片下载按钮点击事件
    historyDownloadBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        downloadHistoryImages(row);
    });

    // 尺寸选择
    const sizeSelect = row.querySelector('.size-select');
    const sizeCustom = row.querySelector('.size-custom');
    const modelSelect = row.querySelector('.model-select');
    const resolutionGroup = row.querySelector('.resolution-group');

    function updateResolutionState() {
        if (!resolutionGroup) return;
        const resSelect = row.querySelector('.resolution-select');
        if (!resSelect) return;
        const isGPT = modelSelect.value && modelSelect.value.startsWith('gpt');
        const isSquare = sizeSelect.value === '1:1';
        const enabled = isGPT && isSquare;

        if (enabled) {
            resSelect.innerHTML = RESOLUTION_OPTIONS.map(r => `<option value="${r.label}">${r.label}</option>`).join('');
            resSelect.disabled = false;
        } else {
            resSelect.innerHTML = '<option value="">未开放</option>';
            resSelect.disabled = true;
        }
    }

    // 模型选择变化时切换尺寸选项
    modelSelect.addEventListener('change', function() {
        const selectedModel = this.value;
        const currentSize = sizeSelect.value;

        // 清空现有选项
        sizeSelect.innerHTML = '';

        if (selectedModel === 'gemini-3.1-flash-image-preview') {
            // 使用Gemini尺寸预设
            geminiSizePresets.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                sizeSelect.appendChild(option);
            });
            // 默认选择1:1
            sizeSelect.value = '1:1';
        } else {
            // 使用默认尺寸预设
            sizePresets.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                sizeSelect.appendChild(option);
            });
            // 尝试保持之前的选择，如果不存在则选择第一个
            if (sizePresets.includes(currentSize)) {
                sizeSelect.value = currentSize;
            }
        }
        updateResolutionState();
    });

    // 初始化分辨率按钮可见性
    updateResolutionState();

    sizeSelect.addEventListener('change', function() {
        if (this.value === '自定义') {
            sizeCustom.style.display = 'block';
        } else {
            sizeCustom.style.display = 'none';
        }
        updateResolutionState();
    });

    // 提示词输入按钮、显示区域和主图/A+按钮
    const promptInputBtn = row.querySelector('.prompt-input-btn');
    const promptDisplay = row.querySelector('.prompt-display');
    const mainImageBtn = row.querySelector('.main-image-btn');
    const aplusBtn = row.querySelector('.aplus-btn');
    const extractDisplay = row.querySelector('.extract-display');

    // 监听提取结果变化，控制主图/A+按钮状态
    const observer = new MutationObserver(function() {
        const currentRowId = parseInt(row.dataset.rowId);
        const status = rowExtractStatus.get(currentRowId);

        if (status === EXTRACT_STATUS.COMPLETED && !promptGeneratingRows.has(currentRowId)) {
            if (mainImageBtn) mainImageBtn.disabled = false;
            if (aplusBtn) aplusBtn.disabled = false;
        } else {
            if (mainImageBtn) mainImageBtn.disabled = true;
            if (aplusBtn) aplusBtn.disabled = true;
        }
    });

    observer.observe(extractDisplay, {
        childList: true,
        characterData: true,
        subtree: true
    });

    // 主图按钮 → AI生成主图提示词
    mainImageBtn.addEventListener('click', function() {
        generatePrompts(rowId, 'main');
    });

    // A+按钮 → AI生成A+提示词
    aplusBtn.addEventListener('click', function() {
        generatePrompts(rowId, 'aplus');
    });

    // 提示词输入按钮 → 手动输入弹窗
    promptInputBtn.addEventListener('click', function() {
        openPromptEditModal(rowId);
    });

    // 提示词显示区域点击 → 编辑弹窗
    promptDisplay.addEventListener('click', function() {
        openPromptEditModal(rowId);
    });

    // 测试生成按钮
    const testGenerateBtn = row.querySelector('.test-generate-btn');
    testGenerateBtn.addEventListener('click', function() {
        testGenerateImages(rowId);
    });

    // 生成按钮
    const generateBtn = row.querySelector('.generate-btn');
    generateBtn.addEventListener('click', function() {
        generateImage(rowId);
    });

    // 结果图片点击放大
    const resultDisplay = row.querySelector('.image-display');
    resultDisplay.addEventListener('click', function() {
        const img = resultDisplay.querySelector('img');
        if (img && img.src) {
            showImageModal(img.src);
        }
    });

    // 序号单元格点击事件 - 实现选择逻辑
    const rowNumberSpan = row.querySelector('.row-number');
    const deleteBtn = row.querySelector('.delete-btn-hidden');

    rowNumberCell.addEventListener('click', function(e) {
        e.stopPropagation();
        const rowId = parseInt(row.dataset.rowId);

        if (e.shiftKey && lastClickedRowId !== null) {
            // Shift+点击：范围选择（保留之前的选择）
            const start = Math.min(lastClickedRowId, rowId);
            const end = Math.max(lastClickedRowId, rowId);

            for (let i = start; i <= end; i++) {
                selectedRows.add(i);
            }
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+点击：切换选择状态
            if (selectedRows.has(rowId)) {
                selectedRows.delete(rowId);
            } else {
                selectedRows.add(rowId);
            }
        } else {
            // 普通点击：单选（清除其他选择）
            selectedRows.clear();
            selectedRows.add(rowId);
        }

        lastClickedRowId = rowId;
        updateSelectionUI();
    });

    // 序号单元格双击事件 - 显示批量导入和复制到下方
    rowNumberCell.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        // 双击组长序号：滚动到组最下方（展开按钮行）
        const groupId = rowToGroup.get(rowId);
        if (groupId) {
            const rowIds = rowGroups.get(groupId);
            if (rowIds && rowIds[0] === rowId) {
                const expandRow = document.querySelector(`.group-expand-row[data-group-id="${groupId}"]`);
                if (expandRow) {
                    expandRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // 短暂高亮展开按钮行
                    expandRow.style.backgroundColor = '#fff3cd';
                    setTimeout(() => { expandRow.style.backgroundColor = ''; }, 1000);
                    return;
                }
            }
        }
        showCopyToBottomMenu(row, e);
    });

    // 隐藏删除按钮（不再使用）
    deleteBtn.style.display = 'none';
    // 卖点输入框监听
    const sellingPointInput = row.querySelector('.selling-point-input');
    const extractBtn = row.querySelector('.extract-btn');

    sellingPointInput.addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            extractBtn.style.display = 'block';
        } else {
            extractBtn.style.display = 'none';
        }
    });

    // 提取按钮点击事件
    extractBtn.addEventListener('click', function() {
        extractWithAI(rowId);
    });

    // 提取结果显示框点击事件
    extractDisplay.addEventListener('click', function() {
        openExtractEditModal(rowId);
    });

    // 输入框自动保存
    const inputs = row.querySelectorAll('input[type="text"], textarea, select');
    inputs.forEach(input => {
        input.addEventListener('input', scheduleSaveData);
        input.addEventListener('change', scheduleSaveData);
    });
    sellingPointInput.addEventListener('input', scheduleSaveData);
}

// 全局点击事件，点击非序号区域时取消选中，点击展开区域外时收起提示词，移除行闪烁效果
document.addEventListener('click', function(e) {
    // 处理行选中逻辑
    if (!e.target.closest('.row-number-cell')) {
        // 点击其他地方时清除所有选择
        if (selectedRows.size > 0) {
            selectedRows.clear();
            lastClickedRowId = null;
            updateSelectionUI();
        }
    }

    // 处理提示词展开/收起逻辑
    const expandRow = document.querySelector('tr.prompt-expand-row');
    if (expandRow) {
        // 检查点击是否在展开区域内或展开按钮上
        const clickedInExpandArea = e.target.closest('.prompt-expand-row');
        const clickedExpandBtn = e.target.closest('.prompt-expand-btn');

        if (!clickedInExpandArea && !clickedExpandBtn) {
            // 点击在展开区域外，自动收起
            const parentRowId = expandRow.dataset.parentRow;
            const parentRow = document.querySelector(`tr[data-row-id="${parentRowId}"]`);
            if (parentRow) {
                const promptBtn = parentRow.querySelector('.prompt-expand-btn');
                if (promptBtn && promptBtn.dataset.type) {
                    expandRow.remove();
                    updatePromptButtonText(parentRow, promptBtn.dataset.type);
                }
            }
        }
    }

    // 移除所有行的闪烁效果
    const blinkingRows = document.querySelectorAll('.row-blink');
    blinkingRows.forEach(row => {
        row.classList.remove('row-blink');
    });

    // 移除所有生成完成标记
    const completeBadges = document.querySelectorAll('.generation-complete-badge');
    completeBadges.forEach(badge => {
        badge.remove();
    });
});

// 更新选择UI
function updateSelectionUI() {
    const toolbar = document.getElementById('toolbar');
    const selectionInfo = document.getElementById('selectionInfo');
    const rows = document.querySelectorAll('#tableBody tr');

    // 更新所有行的选中状态样式
    rows.forEach(row => {
        const rowId = parseInt(row.dataset.rowId);
        if (selectedRows.has(rowId)) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });

    // 显示/隐藏工具栏
    if (selectedRows.size >= 2) {
        toolbar.style.display = 'flex';
        selectionInfo.textContent = `已选中 ${selectedRows.size} 行`;
    } else {
        toolbar.style.display = 'none';
    }
}

// 删除选中的行
function deleteSelectedRows() {
    if (selectedRows.size === 0) return;

    if (confirm(`确定要删除选中的 ${selectedRows.size} 行吗？`)) {
        const toDelete = [...selectedRows];
        toDelete.forEach(rowId => {
            const groupId = rowToGroup.get(rowId);
            if (groupId) {
                const members = rowGroups.get(groupId);
                if (members && members.length <= 2) {
                    ungroupAll(groupId);
                } else if (members) {
                    removeFromGroup(rowId, groupId);
                }
            }
            const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
            if (row) {
                rowExtractStatus.delete(rowId);
                row.remove();
            }
        });

        selectedRows.clear();
        lastClickedRowId = null;
        updateRowNumbers();
        updateSelectionUI();
        scheduleSaveData();
        saveGroupState();
    }
}

// 取消选择
function cancelSelection() {
    selectedRows.clear();
    lastClickedRowId = null;
    updateSelectionUI();
}

// 测试生成图片（生成前2个提示词）
async function testGenerateImages(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    const testGenerateBtn = row.querySelector('.test-generate-btn');
    const resultDisplay = row.querySelector('.image-display');
    const historyThumbnails = row.querySelector('.history-thumbnails');

    // 检查是否已经测试过
    if (rowTestGeneratedStatus.has(parseInt(rowId))) {
        alert('该行已经执行过测试生成！');
        return;
    }

    // 获取提示词数据
    const promptExpandBtn = row.querySelector('.prompt-expand-btn');
    if (!promptExpandBtn || !promptExpandBtn.promptsData) {
        alert('请先生成提示词！');
        return;
    }

    const prompts = promptExpandBtn.promptsData;
    if (prompts.length < 2) {
        alert('提示词数量不足2个，无法进行测试生成！');
        return;
    }

    // 获取前2个提示词
    const testPrompts = prompts.slice(0, 2);
    const type = promptExpandBtn.dataset.type;

    // 获取尺寸和模型设置
    const sizeSelect = row.querySelector('.size-select');
    const sizeCustom = row.querySelector('.size-custom');
    const modelSelect = row.querySelector('.model-select');

    const getCurrentAspectRatio = () => {
        return sizeSelect.value === '自定义' ? sizeCustom.value : sizeSelect.value;
    };

    const selectedModel = modelSelect ? modelSelect.value : 'gpt-image-2';
    const aspectRatio = getCurrentAspectRatio();

    if (!aspectRatio) {
        alert('请选择图片尺寸！');
        return;
    }

    // 验证API设置
    if (selectedModel === 'gemini-3.1-flash-image-preview') {
        if (!aiSettings.geminiApiBaseUrl || !aiSettings.geminiApiKey) {
            alert('请先按J键配置Gemini图片生成API设置！');
            return;
        }
    } else {
        if (!aiSettings.imageGenApiBaseUrl || !aiSettings.imageGenApiKey) {
            alert('请先按J键配置图片生成API设置！');
            return;
        }
    }

    // 获取参考图片（支持多图参考）
    const referenceImages = (row.productImages || []).filter(
        img => img && img !== window.location.href && !img.startsWith('http')
    );

    // 禁用按钮
    testGenerateBtn.disabled = true;
    const originalText = testGenerateBtn.textContent;

    try {
        testGenerateBtn.textContent = `测试生成中 (0/2)`;

        // 并行发送所有API请求
        const generatePromises = testPrompts.map(async (prompt, i) => {
            console.log(`发送第 ${i + 1} 个提示词请求:`, prompt.title);

            const currentAspectRatio = getCurrentAspectRatio();
            let response;

            if (selectedModel === 'gemini-3.1-flash-image-preview') {
                // Gemini API调用
                const requestBody = {
                    model: 'nano-banana-2',
                    prompt: prompt.content,
                    aspect_ratio: currentAspectRatio,
                    response_format: 'url'
                };

                if (referenceImages.length > 0) {
                    requestBody.image = referenceImages;
                }

                response = await fetch(`${aiSettings.geminiApiBaseUrl}/v1/images/generations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${aiSettings.geminiApiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });
            } else {
                // GPT API调用
                const resolution = getSelectedResolution(row);
                const apiSize = (currentAspectRatio === '1:1' && selectedModel.startsWith('gpt') && resolution)
                    ? getResolutionSize(resolution)
                    : currentAspectRatio;

                const requestBody = {
                    model: selectedModel,
                    prompt: prompt.content,
                    size: apiSize
                };

                if (referenceImages.length > 0) {
                    requestBody.image = referenceImages;
                }

                response = await fetch(`${aiSettings.imageGenApiBaseUrl}/v1/images/generations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${aiSettings.imageGenApiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('=== API错误响应 ===');
                console.error('状态码:', response.status);
                console.error('状态文本:', response.statusText);
                console.error('错误内容:', errorText);
                throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
            }

            const data = await response.json();

            if (data.data && data.data.length > 0 && data.data[0].url) {
                return { imageUrl: data.data[0].url, index: i };
            } else {
                throw new Error('API返回数据格式错误');
            }
        });

        // 等待所有请求完成，并在每个完成时更新进度
        let completedCount = 0;
        const results = await Promise.all(
            generatePromises.map(promise =>
                promise.then(result => {
                    completedCount++;
                    testGenerateBtn.textContent = `测试生成中 (${completedCount}/2)`;
                    return result;
                })
            )
        );

        // 处理所有返回的图片
        results.forEach((result, i) => {
            const { imageUrl, index } = result;

            // 第一张显示在结果区域
            if (i === 0) {
                resultDisplay.classList.remove('empty');
                resultDisplay.innerHTML = `<img src="${imageUrl}" alt="生成结果">`;
            }

            // 所有图片都添加到历史记录
            addToHistory(row, imageUrl, type, index);
        });

        // 标记该行已经测试过
        rowTestGeneratedStatus.add(parseInt(rowId));

        // 自动取消勾选已测试的前2个提示词
        if (row.promptCheckStates && row.promptCheckStates[type]) {
            row.promptCheckStates[type][0] = false;
            row.promptCheckStates[type][1] = false;
            // 更新提示词状态显示
            updatePromptStatus(row, type);
        }

        alert('测试生成完成！已生成前2个提示词的图片。');

    } catch (error) {
        console.error('测试生成失败:', error);
        alert(`测试生成失败: ${error.message}`);
    } finally {
        // 保持按钮禁用状态，改变文本为"已测试"
        testGenerateBtn.disabled = true;
        testGenerateBtn.textContent = '已测试';
    }
}

// 生成图片
async function generateImage(rowId, isBatchMode = false) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    const generateBtn = row.querySelector('.generate-btn');
    const resultDisplay = row.querySelector('.image-display');
    const historyThumbnails = row.querySelector('.history-thumbnails');

    // 获取尺寸选择器（但不立即读取值）
    const sizeSelect = row.querySelector('.size-select');
    const sizeCustom = row.querySelector('.size-custom');
    const modelSelect = row.querySelector('.model-select');

    // 创建一个函数来获取当前尺寸，确保每次都读取最新值
    const getCurrentAspectRatio = () => {
        return sizeSelect.value === '自定义' ? sizeCustom.value : sizeSelect.value;
    };

    // 获取选中的模型
    const selectedModel = modelSelect ? modelSelect.value : 'gpt-image-2';
    console.log('=== 模型选择信息 ===');
    console.log('选中的模型:', selectedModel);

    // 验证API设置
    if (selectedModel === 'gemini-3.1-flash-image-preview') {
        if (!aiSettings.geminiApiBaseUrl || !aiSettings.geminiApiKey) {
            if (!isBatchMode) alert('请先按J键配置Gemini图片生成API设置！');
            return;
        }
    } else {
        if (!aiSettings.imageGenApiBaseUrl || !aiSettings.imageGenApiKey) {
            if (!isBatchMode) alert('请先按J键配置图片生成API设置！');
            return;
        }
    }

    // 验证尺寸是否已选择
    const aspectRatio = getCurrentAspectRatio();
    console.log('=== 尺寸调试信息 ===');
    console.log('sizeSelect.value:', sizeSelect.value);
    console.log('sizeCustom.value:', sizeCustom.value);
    console.log('最终使用的 aspectRatio:', aspectRatio);

    if (!aspectRatio) {
        if (!isBatchMode) alert('请选择图片尺寸！');
        return;
    }

    // 获取提示词：从 prompt-display 或 prompt-expand-btn 获取
    const promptDisplay = row.querySelector('.prompt-display');
    const promptBtn = row.querySelector('.prompt-expand-btn');

    let selectedPrompts = [];
    let type = 'manual';

    if (promptDisplay && promptDisplay.style.display !== 'none' && promptDisplay.textContent !== '未输入') {
        // 手动输入的提示词
        selectedPrompts.push({
            index: 0,
            content: promptDisplay.textContent
        });
    } else if (promptBtn && promptBtn.promptsData) {
        // AI生成的提示词
        const prompts = promptBtn.promptsData;
        type = promptBtn.dataset.type;

        if (!row.promptCheckStates || !row.promptCheckStates[type]) {
            if (!isBatchMode) alert('请先生成提示词！');
            return;
        }

        row.promptCheckStates[type].forEach((checked, index) => {
            if (checked && prompts[index]) {
                selectedPrompts.push({
                    index: index,
                    content: prompts[index].content
                });
            }
        });
    } else {
        if (!isBatchMode) alert('请先输入提示词！');
        return;
    }

    if (selectedPrompts.length === 0) {
        if (!isBatchMode) alert('请至少选择一个提示词！');
        return;
    }

    // 获取参考图片（支持多图参考，使用商品图作为参考图）
    const referenceImages = (row.productImages || []).filter(
        img => img && img !== window.location.href && !img.startsWith('http')
    );

    // 显示加载状态
    generateBtn.classList.add('loading');
    generateBtn.disabled = true;

    // 启动计时器
    const startTime = Date.now();
    let timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const sec = Math.floor(elapsed / 1000);
        const ms = Math.floor((elapsed % 1000) / 10);
        generateBtn.textContent = `${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }, 50);

    try {
        // 创建所有API请求的Promise数组
        const apiPromises = [];
        const currentAspectRatio = getCurrentAspectRatio();

        console.log(`=== 准备发送 ${selectedPrompts.length} 个API请求 ===`);
        console.log('使用的尺寸:', currentAspectRatio);
        console.log('使用的模型:', selectedModel);

        // 间隔1秒发送每个API请求
        for (let i = 0; i < selectedPrompts.length; i++) {
            const promptData = selectedPrompts[i];
            const promptText = promptData.content;
            const promptIndex = promptData.index;

            // 创建API请求Promise
            const apiPromise = (async () => {
                let response;

                if (selectedModel === 'gemini-3.1-flash-image-preview') {
                    // Gemini API调用
                    const requestBody = {
                        model: 'nano-banana-2',
                        prompt: promptText,
                        aspect_ratio: currentAspectRatio,
                        response_format: 'url'
                    };

                    if (referenceImages.length > 0) {
                        requestBody.image = referenceImages;
                    }

                    console.log(`发送Gemini请求 ${i + 1}:`, promptText.substring(0, 50) + '...');

                    response = await fetch(`${aiSettings.geminiApiBaseUrl}/v1/images/generations`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${aiSettings.geminiApiKey}`
                        },
                        body: JSON.stringify(requestBody)
                    });
                } else {
                    // GPT API调用
                    const resolution = getSelectedResolution(row);
                    const apiSize = (currentAspectRatio === '1:1' && selectedModel.startsWith('gpt') && resolution)
                        ? getResolutionSize(resolution)
                        : currentAspectRatio;

                    const requestBody = {
                        model: selectedModel,
                        prompt: promptText,
                        size: apiSize
                    };

                    if (referenceImages.length > 0) {
                        requestBody.image = referenceImages;
                    }

                    console.log(`发送GPT请求 ${i + 1}:`, promptText.substring(0, 50) + '...');

                    response = await fetch(`${aiSettings.imageGenApiBaseUrl}/v1/images/generations`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${aiSettings.imageGenApiKey}`
                        },
                        body: JSON.stringify(requestBody)
                    });
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`请求 ${i + 1} 失败:`, response.status, errorText);
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                console.log(`请求 ${i + 1} 返回成功`);

                return {
                    data: data,
                    promptIndex: promptIndex,
                    promptType: type
                };
            })();

            apiPromises.push(apiPromise);

            // 间隔1秒发送下一个请求（最后一个不需要等待）
            if (i < selectedPrompts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // 所有请求已发送，等待所有结果返回
        console.log('所有请求已发送，等待返回结果...');

        // 使用Promise.allSettled等待所有请求完成（包括失败的）
        const results = await Promise.allSettled(apiPromises);

        // 处理每个返回的结果
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < results.length; i++) {
            const result = results[i];

            if (result.status === 'fulfilled') {
                const { data, promptIndex, promptType } = result.value;

                // 提取生成的图片URL
                if (data.data && data.data.length > 0 && data.data[0].url) {
                    const imageUrl = data.data[0].url;

                    // 将图片URL转换为base64并保存到缓存
                    let cachedImageUrl = imageUrl;
                    try {
                        if (imageUrl.startsWith('http')) {
                            const imgResponse = await fetch(imageUrl);
                            const blob = await imgResponse.blob();
                            const base64 = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                            cachedImageUrl = await saveImageToCache(base64);
                        } else if (imageUrl.startsWith('data:image')) {
                            cachedImageUrl = await saveImageToCache(imageUrl);
                        }
                    } catch (cacheError) {
                        console.error('缓存图片失败，使用原始URL:', cacheError);
                        cachedImageUrl = imageUrl;
                    }

                    // 显示最后一张成功的图片在结果图片模块
                    resultDisplay.classList.remove('empty');
                    resultDisplay.innerHTML = `<img src="${cachedImageUrl}" alt="生成结果">`;

                    // 添加到历史记录
                    addToHistory(row, cachedImageUrl, promptType, promptIndex);

                    // 自动取消勾选已生成的提示词
                    if (row.promptCheckStates && row.promptCheckStates[promptType]) {
                        row.promptCheckStates[promptType][promptIndex] = false;
                    }

                    successCount++;
                    console.log(`成功接收第 ${successCount} 张图片`);
                } else {
                    console.error(`结果 ${i + 1} 数据格式错误`);
                    failCount++;
                }
            } else {
                console.error(`请求 ${i + 1} 失败:`, result.reason);
                failCount++;
            }
        }

        // 更新提示词状态显示
        if (row.promptCheckStates && row.promptCheckStates[type]) {
            updatePromptStatus(row, type);
        }

        // 停止计时器，恢复按钮
        clearInterval(timerInterval);
        generateBtn.textContent = '生成';

        // 在序号单元格添加完成标记
        const rowNumberCell = row.querySelector('.row-number-cell');
        if (rowNumberCell && !rowNumberCell.querySelector('.generation-complete-badge')) {
            const badge = document.createElement('span');
            badge.className = 'generation-complete-badge';
            badge.textContent = '✓';
            badge.style.cssText = `
                display: inline-block;
                margin-left: 5px;
                color: #4CAF50;
                font-size: 18px;
                font-weight: bold;
                animation: fadeInScale 0.5s ease-out;
            `;
            rowNumberCell.appendChild(badge);
        }

    } catch (error) {
        console.error('图片生成失败:', error);
        clearInterval(timerInterval);
        generateBtn.textContent = '生成';
        if (!isBatchMode) alert(`生成失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        clearInterval(timerInterval);
        generateBtn.classList.remove('loading');
        generateBtn.disabled = false;
    }
}

// 生成占位图片（实际应用中替换为真实的AI生成）
function generatePlaceholderImage(productName, size, prompt) {
    // 使用 placeholder 服务生成示例图片
    const [width, height] = parseSize(size);
    return `https://via.placeholder.com/${width}x${height}/4a90e2/ffffff?text=${encodeURIComponent(prompt)}`;
}

// 解析尺寸
function parseSize(size) {
    if (size.includes('×')) {
        const [w, h] = size.split('×').map(s => parseInt(s));
        return [w, h];
    } else if (size.includes(':')) {
        const [w, h] = size.split(':').map(s => parseInt(s));
        return [w * 100, h * 100];
    }
    return [400, 400];
}

// 添加到历史记录
function addToHistory(row, imageUrl, promptType, promptIndex) {
    console.log('addToHistory 被调用', row, imageUrl, promptType, promptIndex);

    if (!row) {
        console.log('row 为空，返回');
        return;
    }

    // 初始化历史图片数组
    if (!row.historyImages) {
        row.historyImages = [];
    }

    // 初始化图片与提示词的映射关系
    if (!row.imagePromptMap) {
        row.imagePromptMap = [];
    }

    // 添加图片到数组
    row.historyImages.push(imageUrl);

    // 记录图片与提示词的关联
    row.imagePromptMap.push({
        imageUrl: imageUrl,
        promptType: promptType,
        promptIndex: promptIndex,
        resolution: getSelectedResolution(row) || '1K'
    });

    console.log('当前历史图片数量:', row.historyImages.length);

    // 获取缩略图容器和展开按钮
    const thumbnailsContainer = row.querySelector('.history-thumbnails');
    const galleryBtn = row.querySelector('.history-gallery-btn');

    console.log('thumbnailsContainer:', thumbnailsContainer);
    console.log('galleryBtn:', galleryBtn);

    if (!thumbnailsContainer) {
        console.log('找不到 thumbnailsContainer');
        return;
    }

    // 清空缩略图容器
    thumbnailsContainer.innerHTML = '';

    // 显示所有历史图片的缩略图
    row.historyImages.forEach((imgUrl, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'history-thumbnail';
        thumbnail.innerHTML = `<img src="${imgUrl}" alt="历史${index + 1}">`;

        // 点击查看大图
        thumbnail.addEventListener('click', function(e) {
            e.stopPropagation();
            showImageModal(imgUrl, row.historyImages, index, row);
        });

        thumbnailsContainer.appendChild(thumbnail);
        console.log('添加缩略图:', index + 1);
    });

    // 显示展开按钮和下载按钮
    if (row.historyImages.length > 0) {
        galleryBtn.style.display = 'block';
        const downloadBtn = row.querySelector('.history-download-btn');
        if (downloadBtn) {
            downloadBtn.style.display = 'block';
        }
        console.log('显示展开按钮');
    }
    scheduleSaveData();
}

// 删除历史图片
function deleteHistoryImage(row, imageIndex) {
    if (!row || !row.historyImages || imageIndex < 0 || imageIndex >= row.historyImages.length) {
        console.error('删除图片失败：参数无效');
        return;
    }

    console.log('删除图片，索引:', imageIndex);

    // 获取要删除的图片URL
    const deletedImageUrl = row.historyImages[imageIndex];

    // 从历史图片数组中删除
    row.historyImages.splice(imageIndex, 1);

    // 从图片提示词映射中删除对应项
    if (row.imagePromptMap) {
        row.imagePromptMap.splice(imageIndex, 1);
    }

    // 更新缩略图显示
    const thumbnailsContainer = row.querySelector('.history-thumbnails');
    if (thumbnailsContainer) {
        thumbnailsContainer.innerHTML = '';

        // 重新渲染所有缩略图
        row.historyImages.forEach((imgUrl, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'history-thumbnail';
            thumbnail.innerHTML = `<img src="${imgUrl}" alt="历史${index + 1}">`;

            // 点击查看大图
            thumbnail.addEventListener('click', function(e) {
                e.stopPropagation();
                showImageModal(imgUrl, row.historyImages, index, row);
            });

            thumbnailsContainer.appendChild(thumbnail);
        });
    }

    // 检查结果图片区域是否显示的是被删除的图片
    const resultDisplay = row.querySelector('.image-display');
    if (resultDisplay) {
        const resultImg = resultDisplay.querySelector('img');
        if (resultImg && resultImg.src === deletedImageUrl) {
            // 如果还有其他图片，显示最新的一张
            if (row.historyImages.length > 0) {
                resultDisplay.innerHTML = `<img src="${row.historyImages[row.historyImages.length - 1]}" alt="生成结果">`;
            } else {
                // 没有图片了，恢复空状态
                resultDisplay.classList.add('empty');
                resultDisplay.innerHTML = '<span>未生成</span>';
            }
        }
    }

    // 如果没有历史图片了，隐藏相关按钮
    if (row.historyImages.length === 0) {
        const galleryBtn = row.querySelector('.history-gallery-btn');
        const downloadBtn = row.querySelector('.history-download-btn');
        if (galleryBtn) galleryBtn.style.display = 'none';
        if (downloadBtn) downloadBtn.style.display = 'none';
    }

    // 更新提示词状态
    const promptBtn = row.querySelector('.prompt-expand-btn');
    if (promptBtn && promptBtn.dataset.type) {
        updatePromptStatus(row, promptBtn.dataset.type);
    }

    console.log('图片删除完成，剩余图片数量:', row.historyImages.length);
}

// 显示图片模态框
function showImageModal(imageUrl, allImages = null, currentIndex = 0, row = null) {
    const images = allImages || [imageUrl];
    let currentIdx = currentIndex;

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = `
        position: relative;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const img = document.createElement('img');
    img.src = images[currentIdx];
    img.style.cssText = `
        max-width: 100%;
        max-height: 90vh;
        border-radius: 8px;
        user-select: none;
    `;

    imgContainer.appendChild(img);

    // 声明 counter 变量，供删除按钮使用
    let counter = null;
    let keyHandler = null;

    // 添加删除按钮（仅当有 row 参数且是历史图片时显示）
    if (row && allImages && allImages === row.historyImages) {
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑️ 删除';
        deleteBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: rgba(231, 76, 60, 0.9);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            z-index: 1002;
            transition: all 0.2s;
        `;
        deleteBtn.addEventListener('mouseover', () => {
            deleteBtn.style.background = 'rgba(231, 76, 60, 1)';
            deleteBtn.style.transform = 'scale(1.05)';
        });
        deleteBtn.addEventListener('mouseout', () => {
            deleteBtn.style.background = 'rgba(231, 76, 60, 0.9)';
            deleteBtn.style.transform = 'scale(1)';
        });
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 直接删除图片，不需要确认
            deleteHistoryImage(row, currentIdx);

            // 如果还有其他图片，切换到相邻图片
            if (row.historyImages.length > 0) {
                // 调整当前索引
                if (currentIdx >= row.historyImages.length) {
                    currentIdx = row.historyImages.length - 1;
                }

                // 更新显示
                img.src = row.historyImages[currentIdx];
                if (counter) {
                    counter.textContent = `${currentIdx + 1}/${row.historyImages.length}`;
                }

                // 如果只剩一张图片，移除前后按钮
                if (row.historyImages.length === 1) {
                    const prevBtn = modal.querySelector('button');
                    const nextBtn = modal.querySelectorAll('button')[1];
                    if (prevBtn && prevBtn.innerHTML === '◀') prevBtn.remove();
                    if (nextBtn && nextBtn.innerHTML === '▶') nextBtn.remove();
                    if (counter) counter.remove();
                }
            } else {
                // 没有图片了，关闭模态框
                modal.remove();
            }
        });

        modal.appendChild(deleteBtn);
    }

    // 图片裁剪按钮
    {
        const hasDeleteBtn = row && allImages && allImages === row.historyImages;
        const cropBtn = document.createElement('button');
        cropBtn.innerHTML = '✂️ 图片裁剪';
        cropBtn.style.cssText = `
            position: fixed;
            top: ${hasDeleteBtn ? '70px' : '20px'};
            right: 20px;
            padding: 10px 20px;
            background: rgba(255, 152, 0, 0.9);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            z-index: 1002;
            transition: all 0.2s;
        `;
        cropBtn.addEventListener('mouseover', () => {
            cropBtn.style.background = 'rgba(255, 152, 0, 1)';
            cropBtn.style.transform = 'scale(1.05)';
        });
        cropBtn.addEventListener('mouseout', () => {
            cropBtn.style.background = 'rgba(255, 152, 0, 0.9)';
            cropBtn.style.transform = 'scale(1)';
        });
        cropBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (keyHandler) {
                document.removeEventListener('keydown', keyHandler);
            }
            modal.remove();
            if (typeof window.loadImageToSplitModule === 'function') {
                window.loadImageToSplitModule(images[currentIdx]);
            }
        });
        modal.appendChild(cropBtn);
    }

    if (images.length > 1) {
        // 创建底部控制条容器
        const controlBar = document.createElement('div');
        controlBar.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 15px;
            background: rgba(0,0,0,0.7);
            padding: 10px 20px;
            border-radius: 30px;
            z-index: 1001;
        `;

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '◀';
        prevBtn.style.cssText = `
            width: 36px;
            height: 36px;
            background: rgba(255,255,255,0.9);
            border: none;
            border-radius: 50%;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        prevBtn.addEventListener('mouseover', () => {
            prevBtn.style.background = 'rgba(255,255,255,1)';
            prevBtn.style.transform = 'scale(1.1)';
        });
        prevBtn.addEventListener('mouseout', () => {
            prevBtn.style.background = 'rgba(255,255,255,0.9)';
            prevBtn.style.transform = 'scale(1)';
        });
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx - 1 + images.length) % images.length;
            img.src = images[currentIdx];
            counter.textContent = `${currentIdx + 1}/${images.length}`;
        });

        counter = document.createElement('div');
        counter.textContent = `${currentIdx + 1}/${images.length}`;
        counter.style.cssText = `
            color: white;
            font-size: 16px;
            font-weight: 600;
            min-width: 60px;
            text-align: center;
        `;

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '▶';
        nextBtn.style.cssText = `
            width: 36px;
            height: 36px;
            background: rgba(255,255,255,0.9);
            border: none;
            border-radius: 50%;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        nextBtn.addEventListener('mouseover', () => {
            nextBtn.style.background = 'rgba(255,255,255,1)';
            nextBtn.style.transform = 'scale(1.1)';
        });
        nextBtn.addEventListener('mouseout', () => {
            nextBtn.style.background = 'rgba(255,255,255,0.9)';
            nextBtn.style.transform = 'scale(1)';
        });
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx + 1) % images.length;
            img.src = images[currentIdx];
            counter.textContent = `${currentIdx + 1}/${images.length}`;
        });

        controlBar.appendChild(prevBtn);
        controlBar.appendChild(counter);
        controlBar.appendChild(nextBtn);
        modal.appendChild(controlBar);

        keyHandler = (e) => {
            if (e.key === 'ArrowLeft') {
                prevBtn.click();
            } else if (e.key === 'ArrowRight') {
                nextBtn.click();
            } else if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.removeEventListener('keydown', keyHandler);
                modal.remove();
            }
        });
    } else {
        modal.addEventListener('click', () => modal.remove());
    }

    modal.appendChild(imgContainer);
    document.body.appendChild(modal);
}

// 显示复制到下方菜单
function showCopyToBottomMenu(row, event) {
    // 检查该行是否在组内
    const rowId = parseInt(row.dataset.rowId);
    if (rowToGroup.has(rowId)) {
        // 如果在组内，不显示菜单
        return;
    }

    // 移除已存在的菜单
    const existingMenu = document.querySelector('.copy-to-bottom-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'copy-to-bottom-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 8px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    // 批量导入按钮
    const batchImportBtn = document.createElement('button');
    batchImportBtn.className = 'batch-import-menu-btn';
    batchImportBtn.textContent = '批量导入';
    batchImportBtn.style.cssText = `
        padding: 8px 16px;
        background: #27ae60;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    `;

    batchImportBtn.addEventListener('mouseover', function() {
        this.style.background = '#229954';
    });

    batchImportBtn.addEventListener('mouseout', function() {
        this.style.background = '#27ae60';
    });

    batchImportBtn.addEventListener('click', function() {
        const rowId = parseInt(row.dataset.rowId);
        const batchImportInput = document.getElementById('batchImportInput');

        // 设置临时的目标行ID
        batchImportInput.dataset.targetRowId = rowId;

        // 触发文件选择
        batchImportInput.click();

        removeMenuSafely(menu);
    });

    // 复制到下方按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-to-bottom-btn';
    copyBtn.textContent = '复制到下方';
    copyBtn.style.cssText = `
        padding: 8px 16px;
        background: #4a90e2;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    `;

    copyBtn.addEventListener('mouseover', function() {
        this.style.background = '#357abd';
    });

    copyBtn.addEventListener('mouseout', function() {
        this.style.background = '#4a90e2';
    });

    copyBtn.addEventListener('click', function() {
        copyRowToBottom(row);
        removeMenuSafely(menu);
    });

    menu.appendChild(batchImportBtn);
    menu.appendChild(copyBtn);
    document.body.appendChild(menu);

    // 阻止菜单内的点击事件冒泡
    menu.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // 点击其他地方关闭菜单（延迟更长时间，避免立即触发）
    setTimeout(() => {
        const closeHandler = function(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);

        // 保存清理函数的引用，以便在菜单被移除时清理
        menu._closeHandler = closeHandler;
    }, 200);
}

// 在菜单移除时清理事件监听器
function removeMenuSafely(menu) {
    if (menu._closeHandler) {
        document.removeEventListener('click', menu._closeHandler);
    }
    menu.remove();
}

// 复制行到下方
function copyRowToBottom(sourceRow) {
    const tbody = document.getElementById('tableBody');

    // 添加新行
    rowCount++;
    const newRow = document.createElement('tr');
    newRow.dataset.rowId = rowCount;

    newRow.innerHTML = `
        <td class="row-number-cell" data-row="${rowCount}">
            <span class="row-number">${rowCount}</span>
            <button class="delete-btn-hidden" data-row="${rowCount}">删除</button>
        </td>
        <td>
            <div class="product-upload-wrapper">
                <div class="upload-area product-upload" data-row="${rowCount}">
                    <input type="file" accept="image/*" multiple class="product-file-input" data-row="${rowCount}">
                    <div class="upload-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>上传图片</span>
                    </div>
                    <img class="product-preview" alt="预览">
                    <button class="delete-image-btn product-delete-btn" data-row="${rowCount}" style="display:none;">×</button>
                </div>
                <button class="product-gallery-btn" data-row="${rowCount}" style="display:none;">展开</button>
            </div>
        </td>
        <td>
            <div class="selling-point-container">
                <textarea class="selling-point-input" placeholder="输入卖点" data-row="${rowCount}"></textarea>
                <button class="extract-btn" data-row="${rowCount}" style="display:none;">提取</button>
            </div>
        </td>
        <td>
            <div class="extract-display" data-row="${rowCount}" title="点击查看完整内容">未提取</div>
        </td>
        <td>
            <div class="prompt-container" data-row="${rowCount}">
                <button class="prompt-input-btn" data-row="${rowCount}" title="点击手动输入提示词">
                    输入提示词
                </button>
                <div class="prompt-buttons-container" data-row="${rowCount}">
                    <button class="main-image-btn" data-row="${rowCount}" disabled>主图</button>
                    <button class="aplus-btn" data-row="${rowCount}" disabled>A+</button>
                </div>
                <div class="prompt-display" data-row="${rowCount}" title="点击编辑提示词" style="display: none;">未输入</div>
                <div class="prompt-result-container" data-row="${rowCount}"></div>
            </div>
        </td>
        <td>
            <select class="model-select" data-row="${rowCount}" style="width: 100%; margin-bottom: 5px;">
                <option value="gpt-image-2">gpt-image-2</option>
                <option value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview</option>
            </select>
            <select class="size-select" data-row="${rowCount}">
                ${sizePresets.map(size => `<option value="${size}">${size}</option>`).join('')}
            </select>
            <input type="text" class="size-custom" placeholder="自定义尺寸" style="display:none; margin-top:5px;" data-row="${rowCount}">
            <div class="resolution-group" data-row="${rowCount}" style="margin-top:5px;">
                <select class="resolution-select" data-row="${rowCount}">
                    ${RESOLUTION_OPTIONS.map(r => `<option value="${r.label}">${r.label}</option>`).join('')}
                </select>
            </div>
        </td>
        <td>
            <div class="image-display empty" data-row="${rowCount}">
                <span>未生成</span>
            </div>
        </td>
        <td>
            <div class="history-images-container" data-row="${rowCount}">
                <div class="history-thumbnails" data-row="${rowCount}"></div>
                <div class="history-buttons-wrapper">
                    <button class="history-gallery-btn" data-row="${rowCount}" style="display:none;">展开</button>
                    <button class="history-download-btn" data-row="${rowCount}" style="display:none;" title="下载所有历史图片">下载</button>
                </div>
            </div>
        </td>
        <td>
            <button class="test-generate-btn" data-row="${rowCount}" disabled>测试生成</button>
            <button class="generate-btn" data-row="${rowCount}">生成</button>
        </td>
    `;

    // 检查源行是否在组内
    const sourceRowId = parseInt(sourceRow.dataset.rowId);
    const groupId = rowToGroup.get(sourceRowId);

    let insertPosition;
    if (groupId) {
        // 源行在组内，找到组的最后一个成员行
        const rowIds = rowGroups.get(groupId);
        if (rowIds && rowIds.length > 0) {
            const lastMemberRowId = rowIds[rowIds.length - 1];
            const lastMemberRow = document.querySelector(`tr[data-row-id="${lastMemberRowId}"]`);
            insertPosition = lastMemberRow ? lastMemberRow.nextSibling : sourceRow.nextSibling;
        } else {
            insertPosition = sourceRow.nextSibling;
        }
    } else {
        // 源行不在组内，插入到源行的下方
        insertPosition = sourceRow.nextSibling;
    }

    // 插入新行到计算出的位置
    sourceRow.parentNode.insertBefore(newRow, insertPosition);

    // 绑定事件
    bindRowEvents(newRow);

    // 复制 B、C、D、E 列的内容（商品图、卖点、提取结果、提示词）

    // B列：商品图（支持多张）
    if (sourceRow.productImages && sourceRow.productImages.length > 0) {
        newRow.productImages = [...sourceRow.productImages];

        const newProductPreview = newRow.querySelector('.product-preview');
        const newProductUploadArea = newRow.querySelector('.product-upload');
        const newProductDeleteBtn = newRow.querySelector('.product-delete-btn');
        const newProductGalleryBtn = newRow.querySelector('.product-gallery-btn');

        newProductPreview.src = sourceRow.productImages[0];
        newProductUploadArea.classList.add('has-image');
        newProductDeleteBtn.style.display = 'block';

        // 如果有多张图片，显示展开按钮
        if (sourceRow.productImages.length > 1) {
            newProductGalleryBtn.style.display = 'inline-block';
            newProductGalleryBtn.textContent = `展开 (${sourceRow.productImages.length}张)`;
        }
    }

    // C列：卖点
    const sourceSellingPointInput = sourceRow.querySelector('.selling-point-input');
    if (sourceSellingPointInput && sourceSellingPointInput.value) {
        const newSellingPointInput = newRow.querySelector('.selling-point-input');
        const newExtractBtn = newRow.querySelector('.extract-btn');

        newSellingPointInput.value = sourceSellingPointInput.value;
        newExtractBtn.style.display = 'block';
    }

    // D列：提取结果
    const sourceExtractDisplay = sourceRow.querySelector('.extract-display');
    if (sourceExtractDisplay && sourceExtractDisplay.textContent && sourceExtractDisplay.textContent !== '未提取') {
        const newExtractDisplay = newRow.querySelector('.extract-display');
        newExtractDisplay.textContent = sourceExtractDisplay.textContent;

        // 同步提取状态，使主图和A+按钮可用
        const sourceStatus = rowExtractStatus.get(sourceRowId);
        if (sourceStatus === EXTRACT_STATUS.COMPLETED) {
            const newRowId = parseInt(newRow.dataset.rowId);
            rowExtractStatus.set(newRowId, EXTRACT_STATUS.COMPLETED);

            // 启用主图和A+按钮
            const newMainImageBtn = newRow.querySelector('.main-image-btn');
            const newAplusBtn = newRow.querySelector('.aplus-btn');
            if (newMainImageBtn) newMainImageBtn.disabled = false;
            if (newAplusBtn) newAplusBtn.disabled = false;
        }
    }

    // E列：提示词（复制手动输入的提示词文本）
    const sourcePromptDisplay = sourceRow.querySelector('.prompt-display');
    if (sourcePromptDisplay && sourcePromptDisplay.style.display !== 'none' && sourcePromptDisplay.textContent !== '未输入') {
        const newPromptInputBtn = newRow.querySelector('.prompt-input-btn');
        const newPromptDisplay = newRow.querySelector('.prompt-display');
        const newPromptButtonsContainer = newRow.querySelector('.prompt-buttons-container');

        if (newPromptInputBtn) newPromptInputBtn.style.display = 'none';
        if (newPromptButtonsContainer) newPromptButtonsContainer.style.display = 'none';
        if (newPromptDisplay) {
            newPromptDisplay.textContent = sourcePromptDisplay.textContent;
            newPromptDisplay.style.display = 'block';
        }
    }

    // 其他列保持默认状态（不复制生成的结果图片、历史记录等）

    // 如果源行在组内，将新行也加入到该组
    if (groupId) {
        const rowIds = rowGroups.get(groupId);
        if (rowIds) {
            // 将新行ID添加到组中
            rowIds.push(rowCount);
            rowToGroup.set(rowCount, groupId);

            // 更新组的UI
            updateGroupUI(groupId);
        }
    }

    // 更新所有行号
    updateRowNumbers();

    // 滚动到新行
    setTimeout(() => {
        newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    // 显示提示
    showCopyToast('已复制到下方');
}

// ==================== 表格数据持久化 ====================

function scheduleSaveData() {
    // 已禁用表格数据持久化，刷新页面恢复初始状态
}

function serializeRow(row) {
    const rowId = parseInt(row.dataset.rowId);
    const sellingPointInput = row.querySelector('.selling-point-input');
    const extractDisplay = row.querySelector('.extract-display');
    const promptDisplay = row.querySelector('.prompt-display');
    const modelSelect = row.querySelector('.model-select');
    const sizeSelect = row.querySelector('.size-select');
    const sizeCustom = row.querySelector('.size-custom');
    const resultDisplay = row.querySelector('.image-display');
    const expandBtn = row.querySelector('.prompt-expand-btn');

    let resultImage = null;
    if (resultDisplay && !resultDisplay.classList.contains('empty')) {
        const resultImg = resultDisplay.querySelector('img');
        if (resultImg && resultImg.src) resultImage = resultImg.src;
    }

    const prompts = {};
    if (expandBtn && expandBtn.promptsData) {
        prompts.type = expandBtn.dataset.type;
        prompts.data = expandBtn.promptsData;
        prompts.checkStates = row.promptCheckStates || null;
    }

    return {
        rowId,
        sellingPoint: sellingPointInput ? sellingPointInput.value : '',
        extractText: extractDisplay ? extractDisplay.textContent : '未提取',
        extractStatus: rowExtractStatus.get(rowId) || EXTRACT_STATUS.IDLE,
        promptText: promptDisplay ? promptDisplay.textContent : '未输入',
        model: modelSelect ? modelSelect.value : 'gpt-image-2',
        size: sizeSelect ? sizeSelect.value : '1:1',
        sizeCustom: sizeCustom ? sizeCustom.value : '',
        sizeCustomVisible: sizeCustom ? sizeCustom.style.display !== 'none' : false,
        resolution: getSelectedResolution(row),
        productImages: row.productImages ? [...row.productImages] : [],
        prompts,
        historyImages: row.historyImages ? [...row.historyImages] : [],
        imagePromptMap: row.imagePromptMap ? [...row.imagePromptMap] : [],
        resultImage,
        testGenerated: rowTestGeneratedStatus.has(rowId)
    };
}

function saveData() {
    // 已禁用表格数据持久化
}

function applyRowData(row, data) {
    const rowId = parseInt(row.dataset.rowId);
    const sellingPointInput = row.querySelector('.selling-point-input');
    const extractDisplay = row.querySelector('.extract-display');
    const extractBtn = row.querySelector('.extract-btn');
    const promptInputBtn = row.querySelector('.prompt-input-btn');
    const promptDisplay = row.querySelector('.prompt-display');
    const modelSelect = row.querySelector('.model-select');
    const sizeSelect = row.querySelector('.size-select');
    const sizeCustom = row.querySelector('.size-custom');
    const resolutionGroup = row.querySelector('.resolution-group');
    const productPreview = row.querySelector('.product-preview');
    const uploadPlaceholder = row.querySelector('.upload-placeholder');
    const productDeleteBtn = row.querySelector('.product-delete-btn');
    const productGalleryBtn = row.querySelector('.product-gallery-btn');
    const resultDisplay = row.querySelector('.image-display');

    if (sellingPointInput) {
        sellingPointInput.value = data.sellingPoint || '';
        if (extractBtn) extractBtn.style.display = sellingPointInput.value.trim() ? 'block' : 'none';
    }

    if (extractDisplay) {
        extractDisplay.textContent = data.extractText || '未提取';
    }

    if (data.extractStatus) {
        rowExtractStatus.set(rowId, data.extractStatus);
    }

    if (promptInputBtn && promptDisplay && data.promptText) {
        if (data.promptText && data.promptText !== '未输入') {
            promptInputBtn.style.display = 'none';
            promptDisplay.style.display = 'block';
            promptDisplay.textContent = data.promptText;
        }
    }

    if (modelSelect && data.model) modelSelect.value = data.model;
    if (sizeSelect && data.size) {
        sizeSelect.value = data.size;
        if (sizeCustom) {
            if (data.size === '自定义' || data.sizeCustomVisible) {
                sizeCustom.style.display = 'block';
                sizeCustom.value = data.sizeCustom || '';
            } else {
                sizeCustom.style.display = 'none';
            }
        }
    }

    if (resolutionGroup) {
        const resSelect = row.querySelector('.resolution-select');
        if (resSelect) {
            const isGPT = modelSelect && modelSelect.value && modelSelect.value.startsWith('gpt');
            const isSquare = sizeSelect && sizeSelect.value === '1:1';
            if (isGPT && isSquare) {
                resSelect.innerHTML = RESOLUTION_OPTIONS.map(r => `<option value="${r.label}">${r.label}</option>`).join('');
                resSelect.disabled = false;
                if (data.resolution) resSelect.value = data.resolution;
            } else {
                resSelect.innerHTML = '<option value="">未开放</option>';
                resSelect.disabled = true;
            }
        }
    }

    if (data.productImages && data.productImages.length > 0) {
        row.productImages = [...data.productImages];
        if (productPreview) {
            productPreview.src = row.productImages[0];
            productPreview.style.display = 'block';
        }
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        if (productDeleteBtn) productDeleteBtn.style.display = 'block';
        if (productGalleryBtn) {
            productGalleryBtn.style.display = 'block';
            productGalleryBtn.textContent = `展开 (${row.productImages.length}张)`;
        }
    }

    if (data.prompts && data.prompts.data && data.prompts.type) {
        row.promptCheckStates = data.prompts.checkStates || {};
        displayPromptResults(row, data.prompts.data, data.prompts.type);
    }

    if (data.historyImages && data.historyImages.length > 0) {
        row.historyImages = [...data.historyImages];
        row.imagePromptMap = data.imagePromptMap ? [...data.imagePromptMap] : [];
        const thumbnailsContainer = row.querySelector('.history-thumbnails');
        const galleryBtn = row.querySelector('.history-gallery-btn');
        const downloadBtn = row.querySelector('.history-download-btn');
        if (thumbnailsContainer) {
            thumbnailsContainer.innerHTML = '';
            row.historyImages.forEach((imgUrl, index) => {
                const thumbnail = document.createElement('div');
                thumbnail.className = 'history-thumbnail';
                thumbnail.innerHTML = `<img src="${imgUrl}" alt="历史${index + 1}">`;
                thumbnail.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showImageModal(imgUrl, row.historyImages, index, row);
                });
                thumbnailsContainer.appendChild(thumbnail);
            });
        }
        if (galleryBtn) galleryBtn.style.display = 'block';
        if (downloadBtn) downloadBtn.style.display = 'block';
    }

    if (data.resultImage && resultDisplay) {
        resultDisplay.classList.remove('empty');
        resultDisplay.innerHTML = `<img src="${data.resultImage}" alt="生成结果">`;
    }

    if (data.testGenerated) {
        rowTestGeneratedStatus.add(rowId);
        const testBtn = row.querySelector('.test-generate-btn');
        if (testBtn) testBtn.disabled = true;
    }

    if (data.extractStatus === EXTRACT_STATUS.COMPLETED) {
        const mainImageBtn = row.querySelector('.main-image-btn');
        const aplusBtn = row.querySelector('.aplus-btn');
        if (mainImageBtn && aplusBtn && !promptGeneratingRows.has(rowId)) {
            mainImageBtn.disabled = false;
            aplusBtn.disabled = false;
        }
    }
}

function loadTableData() {
    const raw = localStorage.getItem(TABLE_DATA_KEY);
    if (!raw) return false;

    try {
        const payload = JSON.parse(raw);
        if (!payload.rows || payload.rows.length === 0) return false;

        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        rowCount = 0;
        rowExtractStatus.clear();
        promptGeneratingRows.clear();
        rowTestGeneratedStatus.clear();

        payload.rows.forEach(rowData => {
            addRow(false, rowData.rowId);
            const row = document.querySelector(`tr[data-row-id="${rowData.rowId}"]`);
            if (row) applyRowData(row, rowData);
        });

        rowCount = payload.rowCount || Math.max(...payload.rows.map(r => r.rowId), 0);
        return true;
    } catch (e) {
        console.error('加载表格数据失败:', e);
        return false;
    }
}

// ==================== 分组状态持久化（已禁用） ====================

function saveGroupState() {
    // 已禁用分组状态持久化
}

function loadGroupState() {
    const raw = localStorage.getItem(GROUP_DATA_KEY);
    if (!raw) return;

    try {
        const data = JSON.parse(raw);
        if (data.groupIdCounter != null) groupIdCounter = data.groupIdCounter;
        if (data.nextColorIndex != null) nextColorIndex = data.nextColorIndex;

        (data.groups || []).forEach(g => {
            const validIds = (g.rowIds || []).filter(id =>
                document.querySelector(`tr[data-row-id="${id}"]`)
            ).sort((a, b) => a - b);

            if (validIds.length < 2) return;

            groupIdCounter = Math.max(groupIdCounter, g.groupId);
            rowGroups.set(g.groupId, validIds);
            validIds.forEach(id => rowToGroup.set(id, g.groupId));
            groupColorIndex.set(g.groupId, g.colorIndex ?? 0);
            groupExpandedState.set(g.groupId, !!g.expanded);

            const tbody = document.getElementById('tableBody');
            const leaderRow = document.querySelector(`tr[data-row-id="${validIds[0]}"]`);
            if (leaderRow) {
                let previousRow = leaderRow;
                for (let i = 1; i < validIds.length; i++) {
                    const memberRow = document.querySelector(`tr[data-row-id="${validIds[i]}"]`);
                    if (memberRow && memberRow !== previousRow.nextSibling) {
                        tbody.insertBefore(memberRow, previousRow.nextSibling);
                    }
                    previousRow = memberRow || previousRow;
                }
            }
            updateGroupUI(g.groupId);
        });
    } catch (e) {
        console.error('加载分组状态失败:', e);
    }
}

// 切换商品图片画廊展开/收起
function toggleProductGallery(row) {
    const images = row.productImages || [];
    if (images.length === 0) return;

    const rowId = row.dataset.rowId;
    const existingGalleryRow = document.querySelector(`tr.product-gallery-row[data-parent-row="${rowId}"]`);

    if (existingGalleryRow) {
        // 如果已经展开，则收起
        existingGalleryRow.remove();
        row.querySelector('.product-gallery-btn').classList.remove('expanded');
    } else {
        // 展开画廊
        const galleryRow = document.createElement('tr');
        galleryRow.className = 'product-gallery-row';
        galleryRow.dataset.parentRow = rowId;

        const galleryCell = document.createElement('td');
        galleryCell.colSpan = 9;
        galleryCell.className = 'gallery-cell';

        const galleryContainer = document.createElement('div');
        galleryContainer.className = 'gallery-container';

        const galleryTitle = document.createElement('div');
        galleryTitle.className = 'gallery-title';
        galleryTitle.textContent = `商品图片 (${images.length}张)`;

        const imagesGrid = document.createElement('div');
        imagesGrid.className = 'gallery-grid';

        let dragSrcIndex = -1;
        let currentDragTarget = null;

        images.forEach((imgSrc, index) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'gallery-item';
            imgWrapper.draggable = true;
            imgWrapper.dataset.index = index;

            const img = document.createElement('img');
            img.src = imgSrc;
            img.addEventListener('click', () => showImageModal(imgSrc, images, index));

            // 拖拽事件
            imgWrapper.addEventListener('dragstart', (e) => {
                dragSrcIndex = index;
                imgWrapper.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            imgWrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (index !== dragSrcIndex && currentDragTarget !== imgWrapper) {
                    if (currentDragTarget) currentDragTarget.classList.remove('drag-over');
                    currentDragTarget = imgWrapper;
                    imgWrapper.classList.add('drag-over');
                }
            });

            imgWrapper.addEventListener('dragleave', (e) => {
                if (!imgWrapper.contains(e.relatedTarget)) {
                    if (currentDragTarget === imgWrapper) {
                        imgWrapper.classList.remove('drag-over');
                        currentDragTarget = null;
                    }
                }
            });

            imgWrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                if (currentDragTarget) {
                    currentDragTarget.classList.remove('drag-over');
                    currentDragTarget = null;
                }
                if (dragSrcIndex !== -1 && dragSrcIndex !== index) {
                    const draggedItem = row.productImages.splice(dragSrcIndex, 1)[0];
                    row.productImages.splice(index, 0, draggedItem);
                    row.querySelector('.product-preview').src = row.productImages[0];
                    // 刷新画廊
                    toggleProductGallery(row);
                    setTimeout(() => toggleProductGallery(row), 0);
                }
            });

            imgWrapper.addEventListener('dragend', () => {
                imgWrapper.classList.remove('dragging');
                if (currentDragTarget) {
                    currentDragTarget.classList.remove('drag-over');
                    currentDragTarget = null;
                }
                dragSrcIndex = -1;
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'gallery-item-delete';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                row.productImages.splice(index, 1);
                if (row.productImages.length > 0) {
                    // 更新预览图
                    row.querySelector('.product-preview').src = row.productImages[0];
                    // 更新展开按钮文字
                    const galleryBtn = row.querySelector('.product-gallery-btn');
                    galleryBtn.style.display = 'inline-block';
                    galleryBtn.textContent = `展开 (${row.productImages.length}张)`;
                    // 刷新画廊
                    toggleProductGallery(row);
                    setTimeout(() => toggleProductGallery(row), 0);
                } else {
                    // 没有图片了
                    row.querySelector('.product-upload').classList.remove('has-image');
                    row.querySelector('.product-delete-btn').style.display = 'none';
                    row.querySelector('.product-gallery-btn').style.display = 'none';
                    galleryRow.remove();
                }
            });

            imgWrapper.appendChild(img);
            imgWrapper.appendChild(deleteBtn);
            imagesGrid.appendChild(imgWrapper);
        });

        // 添加更多图片按钮（限制最多8张）
        if (images.length < 8) {
            const addMoreBtn = document.createElement('div');
            addMoreBtn.className = 'gallery-add-more';
            addMoreBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>添加更多 (${images.length}/8)</span>
            `;
            addMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                row.querySelector('.product-file-input').click();
            });
            imagesGrid.appendChild(addMoreBtn);
        }

        galleryContainer.appendChild(galleryTitle);
        galleryContainer.appendChild(imagesGrid);
        galleryCell.appendChild(galleryContainer);
        galleryRow.appendChild(galleryCell);

        row.parentNode.insertBefore(galleryRow, row.nextSibling);
        row.querySelector('.product-gallery-btn').classList.add('expanded');

        // 添加全局点击事件，点击外部区域关闭展开行
        const galleryBtn = row.querySelector('.product-gallery-btn');
        setTimeout(() => {
            const closeHandler = function(e) {
                // 如果点击的是展开行内部或按钮本身，不关闭
                if (galleryRow.contains(e.target) || galleryBtn.contains(e.target)) {
                    return;
                }

                // 点击外部区域，关闭展开行
                galleryRow.remove();
                galleryBtn.classList.remove('expanded');
                document.removeEventListener('click', closeHandler);
            };

            document.addEventListener('click', closeHandler);
        }, 100);
    }
}

// 切换历史图片画廊展开/收起
function toggleHistoryGallery(row) {
    const images = row.historyImages || [];
    if (images.length === 0) return;

    const rowId = row.dataset.rowId;
    const existingGalleryRow = document.querySelector(`tr.history-gallery-row[data-parent-row="${rowId}"]`);

    if (existingGalleryRow) {
        // 如果已经展开，则收起
        existingGalleryRow.remove();
        row.querySelector('.history-gallery-btn').classList.remove('expanded');
    } else {
        // 展开画廊
        const galleryRow = document.createElement('tr');
        galleryRow.className = 'history-gallery-row';
        galleryRow.dataset.parentRow = rowId;

        const galleryCell = document.createElement('td');
        galleryCell.colSpan = 9;
        galleryCell.className = 'gallery-cell';

        const galleryContainer = document.createElement('div');
        galleryContainer.className = 'gallery-container';

        const galleryTitle = document.createElement('div');
        galleryTitle.className = 'gallery-title';
        galleryTitle.textContent = `历史图片 (${images.length}张)`;

        const imagesGrid = document.createElement('div');
        imagesGrid.className = 'gallery-grid';

        images.forEach((imgSrc, index) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'gallery-item';

            const img = document.createElement('img');
            img.src = imgSrc;
            img.addEventListener('click', () => showImageModal(imgSrc, images, index));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'gallery-item-delete';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                // 删除图片
                row.historyImages.splice(index, 1);

                // 同时删除图片与提示词的映射关系
                if (row.imagePromptMap) {
                    row.imagePromptMap.splice(index, 1);
                }

                // 更新缩略图显示
                const thumbnailsContainer = row.querySelector('.history-thumbnails');
                thumbnailsContainer.innerHTML = '';
                row.historyImages.forEach((imgUrl, idx) => {
                    const thumbnail = document.createElement('div');
                    thumbnail.className = 'history-thumbnail';
                    thumbnail.innerHTML = `<img src="${imgUrl}" alt="历史${idx + 1}">`;
                    thumbnail.addEventListener('click', function(e) {
                        e.stopPropagation();
                        showImageModal(imgUrl);
                    });
                    thumbnailsContainer.appendChild(thumbnail);
                });

                // 更新所有提示词的状态
                updateAllPromptStatus(row);

                if (row.historyImages.length > 0) {
                    toggleHistoryGallery(row);
                    setTimeout(() => toggleHistoryGallery(row), 0);
                } else {
                    row.querySelector('.history-gallery-btn').style.display = 'none';
                    const downloadBtn = row.querySelector('.history-download-btn');
                    if (downloadBtn) {
                        downloadBtn.style.display = 'none';
                    }
                    galleryRow.remove();
                }
            });

            imgWrapper.appendChild(img);
            imgWrapper.appendChild(deleteBtn);
            imagesGrid.appendChild(imgWrapper);
        });

        galleryContainer.appendChild(galleryTitle);
        galleryContainer.appendChild(imagesGrid);
        galleryCell.appendChild(galleryContainer);
        galleryRow.appendChild(galleryCell);

        // 智能插入位置：考虑组展开行的情况
        const rowId = parseInt(row.dataset.rowId);
        const groupId = rowToGroup.get(rowId);

        let insertAfter = row;

        // 如果该行在组内，需要找到正确的插入位置
        if (groupId) {
            const rowIds = rowGroups.get(groupId);
            const rowIndex = rowIds.indexOf(rowId);
            const isExpanded = groupExpandedState.get(groupId);

            // 如果组是展开状态，插入到当前行的下一行
            // 如果组是收起状态，插入到组长行的下一行
            if (isExpanded) {
                insertAfter = row;
            } else {
                // 组收起时，找到组长行
                const leaderRowId = rowIds[0];
                const leaderRow = document.querySelector(`tr[data-row-id="${leaderRowId}"]`);
                if (leaderRow) {
                    insertAfter = leaderRow;
                }
            }
        }

        insertAfter.parentNode.insertBefore(galleryRow, insertAfter.nextSibling);
        row.querySelector('.history-gallery-btn').classList.add('expanded');

        // 添加全局点击事件，点击外部区域关闭展开行
        const galleryBtn = row.querySelector('.history-gallery-btn');
        setTimeout(() => {
            const closeHandler = function(e) {
                // 如果点击的是展开行内部或按钮本身，不关闭
                if (galleryRow.contains(e.target) || galleryBtn.contains(e.target)) {
                    return;
                }

                // 点击外部区域，关闭展开行
                galleryRow.remove();
                galleryBtn.classList.remove('expanded');
                document.removeEventListener('click', closeHandler);
            };

            document.addEventListener('click', closeHandler);
        }, 100);
    }
}

// 下载历史图片
async function downloadHistoryImages(row) {
    const images = row.historyImages || [];
    if (images.length === 0) {
        alert('没有可下载的历史图片');
        return;
    }

    // 获取行号作为文件名前缀
    const rowNumber = row.querySelector('.row-number').textContent;

    // 获取下载按钮
    const downloadBtn = row.querySelector('.history-download-btn');
    const originalText = downloadBtn.textContent;

    // 读取用户选择的尺寸
    const sizeSelect = row.querySelector('.size-select').value;

    function getTargetSize(imageIndex) {
        const entry = row.imagePromptMap && row.imagePromptMap[imageIndex];
        const resolution = entry ? entry.resolution : '1K';

        // 仅 1K 的 1:1 图片 resize 到 1600x1600
        if (sizeSelect === '1:1' && resolution === '1K') {
            return { width: 1600, height: 1600 };
        }
        switch (sizeSelect) {
            case '21:9': return { width: 1464, height: 600 };
            case '4:3': return { width: 1200, height: 900 };
            case '3:2': return { width: 970, height: 600 };
            default: return null; // 保持原尺寸（含 2K/4K）
        }
    }

    // 如果只有一张图片，直接下载
    if (images.length === 1) {
        downloadBtn.textContent = '1/1';
        await downloadImage(images[0], `历史图片_行${rowNumber}_1.png`, getTargetSize(0));

        // 下载完成后恢复按钮文字
        setTimeout(() => {
            downloadBtn.textContent = originalText;
        }, 1000);
        return;
    }

    // 多张图片时，逐个下载
    for (let i = 0; i < images.length; i++) {
        // 更新按钮文字显示进度
        const current = i + 1;
        downloadBtn.textContent = `${current}/${images.length}`;

        await downloadImage(images[i], `历史图片_行${rowNumber}_${current}.png`, getTargetSize(i));

        // 添加延迟避免浏览器阻止多个下载
        if (i < images.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    // 下载完成后恢复按钮文字
    setTimeout(() => {
        downloadBtn.textContent = originalText;
    }, 1000);
}

// 缩放图片到指定尺寸（等比缩放+居中裁剪，避免变形）
function resizeImageToSize(url, targetSize) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = function() {
            try {
                // 创建canvas
                const canvas = document.createElement('canvas');
                canvas.width = targetSize.width;
                canvas.height = targetSize.height;

                const ctx = canvas.getContext('2d');
                // 使用高质量缩放
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // 计算缩放比例和裁剪位置（等比缩放+居中裁剪）
                const imgRatio = img.width / img.height;
                const targetRatio = targetSize.width / targetSize.height;

                let drawWidth, drawHeight, offsetX, offsetY;

                if (imgRatio > targetRatio) {
                    // 图片更宽，以高度为基准缩放
                    drawHeight = targetSize.height;
                    drawWidth = img.width * (targetSize.height / img.height);
                    offsetX = (targetSize.width - drawWidth) / 2;
                    offsetY = 0;
                } else {
                    // 图片更高，以宽度为基准缩放
                    drawWidth = targetSize.width;
                    drawHeight = img.height * (targetSize.width / img.width);
                    offsetX = 0;
                    offsetY = (targetSize.height - drawHeight) / 2;
                }

                // 绘制缩放后的图片（居中裁剪）
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

                // 转换为blob - toBlob是异步的，错误需要在回调内处理
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas转换失败'));
                    }
                }, 'image/png', 1.0);
            } catch (error) {
                console.error('Canvas操作失败:', error);
                reject(error);
            }
        };

        img.onerror = function(error) {
            console.error('图片加载失败:', error);
            reject(new Error('图片加载失败'));
        };

        // 对于 data: URLs，直接使用；对于其他 URLs，尝试通过 fetch 转换为 blob URL
        if (url.startsWith('data:')) {
            img.src = url;
        } else {
            // 尝试通过 fetch 获取图片并转换为 blob URL，避免 file:// 协议问题
            fetch(url)
                .then(response => response.blob())
                .then(blob => {
                    img.src = URL.createObjectURL(blob);
                })
                .catch(fetchError => {
                    console.warn('Fetch失败，尝试直接加载:', fetchError);
                    img.src = url;
                });
        }
    });
}

// 下载单张图片
async function downloadImage(url, filename, targetSize = null) {
    try {
        let blob;

        // 如果需要缩放
        if (targetSize) {
            try {
                // 尝试使用 Canvas 缩放
                blob = await resizeImageToSize(url, targetSize);
                console.log('图片已缩放到指定尺寸:', targetSize);
            } catch (canvasError) {
                // Canvas 失败（可能是污染错误）
                console.warn('Canvas 缩放失败，将下载原始尺寸:', canvasError.message);
                blob = null; // 标记为失败，后续使用原始尺寸
            }
        }

        // 如果没有缩放或 Canvas 失败，使用原始尺寸
        if (!blob) {
            if (url.startsWith('data:')) {
                // base64 转 blob，使用 fetch 避免 Canvas 污染
                const response = await fetch(url);
                blob = await response.blob();
            } else {
                // 外部 URL，使用 fetch 转换为 blob
                const response = await fetch(url);
                blob = await response.blob();
            }
        }

        // 检查是否有下载目录句柄
        if (downloadDirHandle) {
            try {
                // 使用File System Access API保存到指定目录
                const fileHandle = await downloadDirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (error) {
                console.error('使用File System Access API保存失败，回退到默认下载:', error);
                // 如果失败，回退到默认下载方式
                downloadDirHandle = null;
            }
        }

        // 如果没有目录句柄或保存失败，使用传统下载方式
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

    } catch (error) {
        console.error('下载失败:', error);
        // 最后的回退方案：直接使用链接下载
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// ========== AI功能相关 ==========

// 打开设置窗口
function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
}

// 关闭设置窗口
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// 切换设置标签页
function switchSettingsTab(tab) {
    // 切换导航按钮状态
    const navBtns = document.querySelectorAll('.settings-nav-btn');
    navBtns.forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 切换内容显示
    const apiTab = document.getElementById('apiTab');
    const templateTab = document.getElementById('templateTab');

    if (tab === 'api') {
        apiTab.classList.add('active');
        templateTab.classList.remove('active');
    } else if (tab === 'template') {
        apiTab.classList.remove('active');
        templateTab.classList.add('active');
    }
}

// 加载AI设置
function loadAISettings() {
    const saved = localStorage.getItem(AI_SETTINGS_KEY);
    if (saved) {
        const savedSettings = JSON.parse(saved);
        // 合并保存的设置和默认设置，确保模板有默认值
        aiSettings = {
            ...aiSettings,
            ...savedSettings,
            // 如果保存的模板为空，使用默认模板
            mainImageTemplate: savedSettings.mainImageTemplate || aiSettings.mainImageTemplate,
            aplusTemplate: savedSettings.aplusTemplate || DEFAULT_APLUS_TEMPLATE
        };
    }

    // 填充到表单 - 图像识别API
    document.getElementById('imageApiBaseUrl').value = aiSettings.imageApiBaseUrl || 'https://ai.comfly.chat';
    document.getElementById('imageApiKey').value = aiSettings.imageApiKey || '';
    document.getElementById('imageModelName').value = aiSettings.imageModelName || 'gpt-5.2';
    document.getElementById('imagePromptTemplate').value = aiSettings.imagePromptTemplate || `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息和图片内容，按照以下格式提取和补充内容。

重要：直接输出格式化结果，不要添加任何额外说明。

一、商品名称 (Product Name)
中文：
商品英文名：

二、商品特征 (Product Features)
中文：
English：

三、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

四、材质信息 (Material Information)
中文：
English：

五、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`;

    // 填充到表单 - 文本分析API
    document.getElementById('textApiBaseUrl').value = aiSettings.textApiBaseUrl || 'https://api.deepseek.com';
    document.getElementById('textApiKey').value = aiSettings.textApiKey || '';
    document.getElementById('textModelName').value = aiSettings.textModelName || 'deepseek-chat';
    document.getElementById('textPromptTemplate').value = aiSettings.textPromptTemplate || `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息，按照以下格式提取和补充内容。

重要：直接输出格式化结果，不要添加任何额外说明。

一、商品名称 (Product Name)
中文：
商品英文名：

二、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

三、材质信息 (Material Information)
中文：
English：

四、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`;

    // 填充到表单 - 主图模板（确保显示默认模板）
    if (document.getElementById('mainImageTemplate')) {
        const mainTemplateTextarea = document.getElementById('mainImageTemplate');
        mainTemplateTextarea.value = aiSettings.mainImageTemplate;
        // 如果值为空，显示默认模板
        if (!mainTemplateTextarea.value.trim()) {
            mainTemplateTextarea.value = `这是一个{product_name}，根据：

{extract_result}

制作一套亚马逊主图提示词（共12张），图片比例为1:1。

【整体风格要求】
- 画面风格：专业高端、简洁大气，符合亚马逊主图规范
- 背景：纯白色背景（主图必须），场景图可用简约背景
- 光线：柔和均匀，突出产品细节
- 色调：明亮清晰，色彩真实
- 构图：产品居中，占画面70-80%
- 景深控制：背景适度虚化即可，避免过度模糊产生波浪效果，保持画面自然清晰

【字体风格统一要求】
- 字体：统一使用现代无衬线字体（Arial, Helvetica, Roboto）
- 主标题颜色：深色系 #2C3E50 或品牌色（字号最大）
- 副标题颜色：中性灰 #7F8C8D（字号中等）
- 强调文字颜色：蓝色 #3498DB 或绿色 #27AE60（用于突出卖点）
- 排版：保持一致的对齐方式和行距
- 语言：全部使用英文

【图片类型】
1. 主图：纯白背景，产品正面完整展示
2. 生活方式图×3：真实使用场景，展现产品应用，**必须包含英文文字说明**
3. 卖点图×2：突出1-3个核心卖点，配图标和文字
4. 卖点汇总图：集中展示所有主要卖点
5. 场景图×2：不同使用环境或角度，**必须包含英文文字标注**
6. 对比图：展示产品优势（与竞品或使用前后对比）
7. 材质工艺图：特写镜头展现材质和工艺细节
8. 尺寸图：标注产品尺寸，配参照物

**重要提示**：生活方式图和场景图必须在画面中清晰显示英文文字，文字内容要简洁有力，突出产品使用场景或核心优势。

请为每张图片生成详细的英文提示词，确保字体风格在所有图片中保持统一。`;
        }
    }

    // 填充到表单 - A+模板（确保显示默认模板）
    if (document.getElementById('aplusTemplate')) {
        const aplusTemplateTextarea = document.getElementById('aplusTemplate');
        aplusTemplateTextarea.value = aiSettings.aplusTemplate;
        // 如果值为空，显示默认模板
        if (!aplusTemplateTextarea.value.trim()) {
            aplusTemplateTextarea.value = DEFAULT_APLUS_TEMPLATE;
        }
    }

    // 填充到表单 - 图片生成API
    document.getElementById('imageGenApiBaseUrl').value = aiSettings.imageGenApiBaseUrl || 'https://ai.comfly.org';
    document.getElementById('imageGenApiKey').value = aiSettings.imageGenApiKey || '';
    document.getElementById('imageGenModelName').value = aiSettings.imageGenModelName || 'gpt-image-2';

    // 填充到表单 - Gemini图片生成API
    document.getElementById('geminiApiBaseUrl').value = aiSettings.geminiApiBaseUrl || 'https://ai.comfly.org';
    document.getElementById('geminiApiKey').value = aiSettings.geminiApiKey || '';

    // 填充到表单 - 下载路径
    document.getElementById('downloadPath').value = aiSettings.downloadPath || '';
}

// 保存AI设置
function saveSettings() {
    aiSettings = {
        // 图像识别API - 只保存API Key和提示词，其他使用默认值
        imageApiBaseUrl: 'https://ai.comfly.org',
        imageApiKey: document.getElementById('imageApiKey').value.trim(),
        imageModelName: 'gpt-5.2',
        imagePromptTemplate: document.getElementById('imagePromptTemplate').value.trim(),

        // 文本分析API - 只保存API Key和提示词，其他使用默认值
        textApiBaseUrl: 'https://api.deepseek.com',
        textApiKey: document.getElementById('textApiKey').value.trim(),
        textModelName: 'deepseek-chat',
        textPromptTemplate: document.getElementById('textPromptTemplate').value.trim(),

        // 主图模板
        mainImageTemplate: document.getElementById('mainImageTemplate') ? document.getElementById('mainImageTemplate').value.trim() : aiSettings.mainImageTemplate,

        // A+模板
        aplusTemplate: document.getElementById('aplusTemplate') ? document.getElementById('aplusTemplate').value.trim() : aiSettings.aplusTemplate,

        // 图片生成API
        imageGenApiBaseUrl: document.getElementById('imageGenApiBaseUrl').value.trim() || 'https://ai.comfly.org',
        imageGenApiKey: document.getElementById('imageGenApiKey').value.trim(),
        imageGenModelName: document.getElementById('imageGenModelName').value.trim() || 'gpt-image-2',

        // Gemini图片生成API
        geminiApiBaseUrl: document.getElementById('geminiApiBaseUrl').value.trim(),
        geminiApiKey: document.getElementById('geminiApiKey').value.trim(),

        // 下载路径
        downloadPath: document.getElementById('downloadPath').value.trim()
    };

    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
    alert('设置已保存！');
    closeSettings();
}

// 选择下载路径
async function selectDownloadPath() {
    try {
        // 检查浏览器是否支持File System Access API
        if (!('showDirectoryPicker' in window)) {
            alert('您的浏览器不支持此功能。\n\n请使用最新版本的Chrome或Edge浏览器。\n\n或者您可以在浏览器设置中手动配置下载路径。');
            return;
        }

        // 让用户选择目录
        const dirHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });

        // 保存目录句柄
        downloadDirHandle = dirHandle;

        // 显示路径名称（仅用于UI显示）
        document.getElementById('downloadPath').value = dirHandle.name;

        // 注意：FileSystemDirectoryHandle无法序列化到localStorage
        // 只保存路径名称作为提示，实际句柄保存在内存中
        aiSettings.downloadPath = dirHandle.name;
        localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));

        alert('下载路径已设置！\n\n注意：此设置仅在当前会话有效，刷新页面后需要重新选择。');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('选择路径失败:', error);
            alert('选择路径失败: ' + error.message);
        }
    }
}

// 清除AI设置
function clearSettings() {
    // 创建选择对话框
    const choice = prompt('请选择要清除的设置：\n1 - 清除API设置（API Key）\n2 - 清除模板设置（提示词模板）\n3 - 清除所有设置\n\n请输入数字 1、2 或 3：');

    if (!choice) {
        return; // 用户取消
    }

    const option = choice.trim();

    if (option === '1') {
        // 清除API设置
        if (!confirm('确定要清除所有API设置（API Key）吗？')) {
            return;
        }

        aiSettings.imageApiKey = '';
        aiSettings.textApiKey = '';
        aiSettings.imageGenApiKey = '';

        localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
        loadAISettings();
        alert('API设置已清除！');

    } else if (option === '2') {
        // 清除模板设置
        if (!confirm('确定要清除所有模板设置（提示词模板）吗？')) {
            return;
        }

        aiSettings.imagePromptTemplate = `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息和图片内容，按照以下格式提取和补充内容。

重要：
1. 仔细观察商品图片，分析商品的外观特点、颜色、设计细节等视觉特征
2. 结合用户提供的卖点信息进行补充和完善
3. 直接输出格式化结果，不要添加任何额外说明

一、商品名称 (Product Name)
中文：
商品英文名：

二、商品特征 (Product Features)
请详细描述商品的外观特点，包括但不限于：
- 颜色：主色调、配色方案
- 设计：造型特点、图案、装饰元素
- 尺寸：大小、比例
- 工艺：缝制、印刷、表面处理等细节
- 其他显著特征

中文：
English：

三、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

四、材质信息 (Material Information)
中文：
English：

五、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`;

        aiSettings.textPromptTemplate = `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息，按照以下格式提取和补充内容。

重要：直接输出格式化结果，不要添加任何额外说明。

一、商品名称 (Product Name)
中文：
商品英文名：

二、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

三、材质信息 (Material Information)
中文：
English：

四、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`;

        // 重置主图和A+模板（如果存在）
        if (aiSettings.mainImageTemplate !== undefined) {
            aiSettings.mainImageTemplate = document.getElementById('mainImageTemplate').defaultValue;
        }
        if (aiSettings.aplusTemplate !== undefined) {
            aiSettings.aplusTemplate = DEFAULT_APLUS_TEMPLATE;
        }

        localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
        loadAISettings();
        alert('模板设置已清除！');

    } else if (option === '3') {
        // 清除所有设置
        if (!confirm('确定要清除所有API和提示词设置吗？')) {
            return;
        }

        // 清除localStorage
        localStorage.removeItem(AI_SETTINGS_KEY);

        // 重置为默认值
        aiSettings = {
            imageApiBaseUrl: 'https://ai.comfly.org',
            imageApiKey: '',
            imageModelName: 'gpt-5.2',
            imagePromptTemplate: `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息和图片内容，按照以下格式提取和补充内容。

重要：
1. 仔细观察商品图片，分析商品的外观特点、颜色、设计细节等视觉特征
2. 结合用户提供的卖点信息进行补充和完善
3. 直接输出格式化结果，不要添加任何额外说明

一、商品名称 (Product Name)
中文：
商品英文名：

二、商品特征 (Product Features)
请详细描述商品的外观特点，包括但不限于：
- 颜色：主色调、配色方案
- 设计：造型特点、图案、装饰元素
- 尺寸：大小、比例
- 工艺：缝制、印刷、表面处理等细节
- 其他显著特征

中文：
English：

三、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

四、材质信息 (Material Information)
中文：
English：

五、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`,
            textApiBaseUrl: 'https://api.deepseek.com',
            textApiKey: '',
            textModelName: 'deepseek-chat',
            textPromptTemplate: `用户提供的原始信息：{卖点}

你是一位精通中英双语的资深亚马逊运营专家。请根据上述原始信息，按照以下格式提取和补充内容。

重要：直接输出格式化结果，不要添加任何额外说明。

一、商品名称 (Product Name)
中文：
商品英文名：

二、核心卖点 (Key Selling Points)
中文：
1、...
核心卖点英文：
1、...

三、材质信息 (Material Information)
中文：
English：

四、使用场景 (Usage Scenarios)
中文：
1、...
英文使用场景：
1、...`,

            // 主图模板
            mainImageTemplate: aiSettings.mainImageTemplate,

            // A+模板
            aplusTemplate: aiSettings.aplusTemplate,

            // 图片生成API
            imageGenApiBaseUrl: 'https://ai.comfly.org',
            imageGenApiKey: '',
            imageGenModelName: 'gpt-image-2',

            // Gemini图片生成API
            geminiApiBaseUrl: 'https://ai.comfly.org',
            geminiApiKey: '',

            // 下载路径
            downloadPath: ''
        };

        // 重新加载表单
        loadAISettings();

        alert('所有设置已清除！');
    } else {
        alert('无效的选项，请输入 1、2 或 3');
    }
}

// 图片转base64
function imageToBase64(imgElement) {
    return new Promise((resolve, reject) => {
        if (!imgElement || !imgElement.src || imgElement.src === window.location.href) {
            reject('无效的图片');
            return;
        }

        // 如果已经是base64，直接返回
        if (imgElement.src.startsWith('data:')) {
            resolve(imgElement.src);
            return;
        }

        // 对于 file:// 或其他 URL，先通过 fetch 转换为 blob，再转为 base64
        fetch(imgElement.src)
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = function() {
                    resolve(reader.result);
                };
                reader.onerror = function() {
                    reject('转换base64失败');
                };
                reader.readAsDataURL(blob);
            })
            .catch(fetchError => {
                console.warn('Fetch失败，尝试使用canvas转换:', fetchError);

                // 回退方案：使用canvas转换
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();

                img.onload = function() {
                    try {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        try {
                            const dataUrl = canvas.toDataURL('image/jpeg');
                            resolve(dataUrl);
                        } catch (securityError) {
                            console.error('Canvas被污染，无法导出:', securityError);
                            reject('Canvas安全错误');
                        }
                    } catch (error) {
                        reject('Canvas转换失败');
                    }
                };

                img.onerror = function() {
                    reject('图片加载失败');
                };

                img.src = imgElement.src;
            });
    });
}

// AI提取功能
async function extractWithAI(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const extractBtn = row.querySelector('.extract-btn');
    const sellingPointInput = row.querySelector('.selling-point-input');
    const extractDisplay = row.querySelector('.extract-display');
    const productPreview = row.querySelector('.product-preview');

    // 验证输入
    const sellingPoint = sellingPointInput.value.trim();
    if (!sellingPoint) {
        alert('请输入卖点！');
        return;
    }

    // 判断是否有商品图片
    const hasImage = productPreview.src && productPreview.src !== window.location.href;

    if (hasImage) {
        // 有图片：调用图像识别API
        await extractWithImageAPI(row, extractBtn, sellingPoint, extractDisplay, productPreview);
    } else {
        // 无图片：调用文本分析API (Deepseek)
        await extractWithTextAPI(row, extractBtn, sellingPoint, extractDisplay);
    }
}

// 图像识别API提取
async function extractWithImageAPI(row, extractBtn, sellingPoint, extractDisplay, productPreview) {
    // 验证设置
    if (!aiSettings.imageApiBaseUrl || !aiSettings.imageApiKey) {
        alert('请先按J键配置图像识别API设置！');
        return;
    }

    const rowId = parseInt(row.dataset.rowId);

    // 设置状态为提取中
    rowExtractStatus.set(rowId, EXTRACT_STATUS.EXTRACTING);

    // 显示加载状态
    extractBtn.disabled = true;
    extractBtn.textContent = '提取中...';
    extractDisplay.textContent = '正在分析图片...';

    try {
        // 转换图片为base64
        const base64Image = await imageToBase64(productPreview);

        // 构建提示词
        const prompt = aiSettings.imagePromptTemplate.replace('{卖点}', sellingPoint);

        // 构建请求体
        const requestBody = {
            model: aiSettings.imageModelName,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: base64Image
                        }
                    }
                ]
            }],
            max_tokens: 2000
        };

        // 调用API
        const response = await fetch(`${aiSettings.imageApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.imageApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        if (data.choices && data.choices.length > 0) {
            const result = data.choices[0].message.content;
            extractDisplay.textContent = result;
            // 设置状态为完成
            rowExtractStatus.set(rowId, EXTRACT_STATUS.COMPLETED);
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('图像识别失败:', error);
        extractDisplay.textContent = '未提取';
        // 设置状态为错误
        rowExtractStatus.set(rowId, EXTRACT_STATUS.ERROR);
        alert(`提取失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        extractBtn.disabled = false;
        extractBtn.textContent = '提取';
        scheduleSaveData();
    }
}

// 文本分析API提取 (Deepseek)
async function extractWithTextAPI(row, extractBtn, sellingPoint, extractDisplay) {
    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

    const rowId = parseInt(row.dataset.rowId);

    // 设置状态为提取中
    rowExtractStatus.set(rowId, EXTRACT_STATUS.EXTRACTING);

    // 显示加载状态
    extractBtn.disabled = true;
    extractBtn.textContent = '分析中...';
    extractDisplay.textContent = '正在分析文本...';

    try {
        // 构建提示词
        const prompt = aiSettings.textPromptTemplate.replace('{卖点}', sellingPoint);

        // 构建请求体
        const requestBody = {
            model: aiSettings.textModelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: false
        };

        // 调用API
        const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.textApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        if (data.choices && data.choices.length > 0) {
            const result = data.choices[0].message.content;
            extractDisplay.textContent = result;
            // 设置状态为完成
            rowExtractStatus.set(rowId, EXTRACT_STATUS.COMPLETED);
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('文本分析失败:', error);
        extractDisplay.textContent = '未提取';
        // 设置状态为错误
        rowExtractStatus.set(rowId, EXTRACT_STATUS.ERROR);
        alert(`分析失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        extractBtn.disabled = false;
        extractBtn.textContent = '提取';
        scheduleSaveData();
    }
}

// 批量提取
async function batchExtract() {
    if (selectedRows.size === 0) {
        alert('请先选择要提取的行！');
        return;
    }

    // 获取所有选中的行ID，并过滤出有卖点输入的行
    const rowIds = Array.from(selectedRows).sort((a, b) => a - b);
    const validRowIds = [];

    for (const rowId of rowIds) {
        const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
        if (row) {
            const sellingPointInput = row.querySelector('.selling-point-input');
            if (sellingPointInput.value.trim()) {
                validRowIds.push(rowId);
            }
        }
    }

    if (validRowIds.length === 0) {
        alert('选中的行中没有输入卖点的行！');
        return;
    }

    // 确认批量提取
    if (!confirm(`将对选中的 ${validRowIds.length} 行进行批量提取，是否继续？`)) {
        return;
    }

    // 依次点击提取按钮，间隔1秒
    for (let i = 0; i < validRowIds.length; i++) {
        const rowId = validRowIds[i];
        const row = document.querySelector(`tr[data-row-id="${rowId}"]`);

        if (row) {
            const extractBtn = row.querySelector('.extract-btn');
            if (extractBtn && extractBtn.style.display !== 'none') {
                // 触发提取
                await extractWithAI(rowId);

                // 如果不是最后一个，等待1秒
                if (i < validRowIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    }

    alert('批量提取完成！');
}

// ========== 提取结果编辑弹窗功能 ==========

// 打开提取结果编辑弹窗
function openExtractEditModal(rowId) {
    currentEditingRowId = rowId;
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const extractDisplay = row.querySelector('.extract-display');
    const currentText = extractDisplay.textContent || '';

    // 填充文本框
    document.getElementById('extractEditTextarea').value = currentText === '未提取' ? '' : currentText;
    document.getElementById('modifyInstruction').value = '';

    // 显示弹窗
    document.getElementById('extractEditModal').style.display = 'flex';
}

// 关闭提取结果编辑弹窗
function closeExtractEditModal() {
    if (currentEditingRowId) {
        // 保存编辑内容
        const row = document.querySelector(`tr[data-row-id="${currentEditingRowId}"]`);
        if (row) {
            const extractDisplay = row.querySelector('.extract-display');
            const newText = document.getElementById('extractEditTextarea').value.trim();
            extractDisplay.textContent = newText || '未提取';

            // 如果用户输入了内容，设置状态为完成，这样按钮会自动启用
            if (newText && newText !== '未提取') {
                rowExtractStatus.set(parseInt(currentEditingRowId), EXTRACT_STATUS.COMPLETED);
            } else {
                // 如果清空了内容，设置为空闲状态
                rowExtractStatus.set(parseInt(currentEditingRowId), EXTRACT_STATUS.IDLE);
            }
        }
    }

    // 关闭弹窗
    document.getElementById('extractEditModal').style.display = 'none';
    currentEditingRowId = null;
}

// 记录当前编辑提示词的行ID
let currentPromptEditRowId = null;

// 打开提示词编辑弹窗
function openPromptEditModal(rowId) {
    currentPromptEditRowId = rowId;
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const promptDisplay = row.querySelector('.prompt-display');
    const currentText = promptDisplay && promptDisplay.style.display !== 'none' ? promptDisplay.textContent : '';

    document.getElementById('freePromptTextarea').value = currentText === '未输入' ? '' : currentText;
    document.getElementById('freePromptModal').style.display = 'flex';
}

// 关闭提示词编辑弹窗（关闭时自动保存）
function closePromptEditModal() {
    autoSavePromptEdit();
    document.getElementById('freePromptModal').style.display = 'none';
    currentPromptEditRowId = null;
}

// 自动保存：输入时实时同步到行
let autoSaveTimer = null;
function autoSavePromptEdit() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (!currentPromptEditRowId) return;

        const freeText = document.getElementById('freePromptTextarea').value.trim();
        const row = document.querySelector(`tr[data-row-id="${currentPromptEditRowId}"]`);
        if (!row) return;

        const promptInputBtn = row.querySelector('.prompt-input-btn');
        const promptDisplay = row.querySelector('.prompt-display');
        const promptButtonsContainer = row.querySelector('.prompt-buttons-container');

        if (freeText) {
            if (promptInputBtn) promptInputBtn.style.display = 'none';
            if (promptButtonsContainer) promptButtonsContainer.style.display = 'none';
            if (promptDisplay) {
                promptDisplay.textContent = freeText;
                promptDisplay.style.display = 'block';
            }
        }
    }, 400);
}

// ==================== 快捷预设管理 ====================
const PRESETS_STORAGE_KEY = 'promptPresets';

// 系统内置预设（不可删除）
const SYSTEM_PRESETS = [
    {
        name: '九宫格（亚马逊）',
        content: '生成九宫格亚马逊电商图（不要出现宫格序号，每个格子之间无缝隙并且每个图片尺寸大小一致），包含：主图、生活方式图×3、卖点图×2、卖点汇总图、场景图×2、对比图、材质工艺图、尺寸图。风格保持一致（画面、字体颜色）严格按照我给你的卖点进行高转化率图片的生成，以下为卖点：'
    },
    {
        name: '白底图',
        content: '图片背景底色变为纯净白色'
    }
];

// 加载用户预设
function loadUserPresets() {
    try {
        const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

// 保存用户预设
function saveUserPresets(presets) {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

// 获取所有预设（系统 + 用户）
function getAllPresets() {
    return [
        ...SYSTEM_PRESETS.map(p => ({ ...p, isSystem: true })),
        ...loadUserPresets().map(p => ({ ...p, isSystem: false }))
    ];
}

// 渲染输入弹窗中的预设列表（无删除按钮，纯快捷插入）
function renderPresets() {
    const allPresets = getAllPresets();
    const listEl = document.getElementById('presetsList');
    if (!listEl) return;

    if (allPresets.length === 0) {
        listEl.innerHTML = '<span class="presets-empty">暂无预设，点击"设置"管理</span>';
        return;
    }

    listEl.innerHTML = allPresets.map((preset, index) => `
        <div class="preset-chip${preset.isSystem ? ' system-preset' : ''}" data-index="${index}" title="${preset.content}">
            ${preset.isSystem ? '<span class="preset-sys-badge">系统</span>' : ''}
            <span class="preset-chip-name">${preset.name}</span>
        </div>
    `).join('');

    // 点击预设 → 填入文本框
    listEl.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const allPresets = getAllPresets();
            if (allPresets[index]) {
                document.getElementById('freePromptTextarea').value = allPresets[index].content;
                autoSavePromptEdit();
            }
        });
    });
}

// ==================== 预设设置弹窗 ====================
let editingPresetIndex = null; // null=添加模式, 数字=编辑模式（用户预设索引）

// 打开预设设置弹窗
function openPresetSettingsModal() {
    document.getElementById('presetSettingsModal').style.display = 'flex';
    renderPresetSettingsList();
}

// 关闭预设设置弹窗
function closePresetSettingsModal() {
    document.getElementById('presetSettingsModal').style.display = 'none';
    closePresetEditSubModal();
}

// 渲染设置列表
function renderPresetSettingsList() {
    const allPresets = getAllPresets();
    const listEl = document.getElementById('presetSettingsList');
    if (!listEl) return;

    if (allPresets.length === 0) {
        listEl.innerHTML = '<div class="preset-settings-empty">暂无预设</div>';
        return;
    }

    listEl.innerHTML = allPresets.map((preset, index) => `
        <div class="preset-settings-item${preset.isSystem ? ' system' : ''}">
            <div class="preset-settings-info">
                <span class="preset-settings-name">${preset.isSystem ? '🔒 ' : ''}${preset.name}</span>
                <span class="preset-settings-preview">${preset.content.substring(0, 40)}...</span>
            </div>
            ${!preset.isSystem ? `
            <div class="preset-settings-actions">
                <button class="preset-edit-btn" data-index="${index}" title="编辑">✎</button>
                <button class="preset-delete-btn" data-index="${index}" title="删除">🗑</button>
            </div>
            ` : ''}
        </div>
    `).join('');

    // 编辑按钮
    listEl.querySelectorAll('.preset-edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const displayIndex = parseInt(this.dataset.index);
            openPresetEditSubModal(displayIndex);
        });
    });

    // 删除按钮
    listEl.querySelectorAll('.preset-delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const displayIndex = parseInt(this.dataset.index);
            deletePresetByDisplayIndex(displayIndex);
        });
    });
}

// 打开编辑/添加子弹窗
function openPresetEditSubModal(displayIndex) {
    const subModal = document.getElementById('presetEditSubModal');
    const titleEl = document.getElementById('presetEditSubTitle');
    const nameInput = document.getElementById('presetEditNameInput');
    const contentInput = document.getElementById('presetEditContentInput');

    if (displayIndex !== null) {
        // 编辑模式
        const allPresets = getAllPresets();
        const preset = allPresets[displayIndex];
        if (!preset || preset.isSystem) return;
        editingPresetIndex = displayIndex - SYSTEM_PRESETS.length;
        titleEl.textContent = '编辑预设';
        nameInput.value = preset.name;
        contentInput.value = preset.content;
    } else {
        // 添加模式
        editingPresetIndex = null;
        titleEl.textContent = '添加预设';
        nameInput.value = '';
        contentInput.value = '';
    }

    subModal.style.display = 'flex';
    nameInput.focus();
}

// 关闭编辑/添加子弹窗
function closePresetEditSubModal() {
    document.getElementById('presetEditSubModal').style.display = 'none';
    editingPresetIndex = null;
}

// 保存预设编辑
function savePresetEdit() {
    const name = document.getElementById('presetEditNameInput').value.trim();
    const content = document.getElementById('presetEditContentInput').value.trim();

    if (!name) { alert('请输入预设名称！'); return; }
    if (!content) { alert('请输入提示词内容！'); return; }

    const userPresets = loadUserPresets();

    if (editingPresetIndex !== null && editingPresetIndex >= 0) {
        // 编辑模式
        userPresets[editingPresetIndex] = { name, content };
    } else {
        // 添加模式
        userPresets.push({ name, content });
    }

    saveUserPresets(userPresets);
    renderPresetSettingsList();
    renderPresets();
    closePresetEditSubModal();
}

// 根据显示索引删除用户预设
function deletePresetByDisplayIndex(displayIndex) {
    const allPresets = getAllPresets();
    const preset = allPresets[displayIndex];
    if (!preset || preset.isSystem) return;

    const userPresets = loadUserPresets();
    const userIndex = displayIndex - SYSTEM_PRESETS.length;
    if (userIndex >= 0 && userIndex < userPresets.length) {
        userPresets.splice(userIndex, 1);
        saveUserPresets(userPresets);
        renderPresetSettingsList();
        renderPresets();
    }
}

// AI修改文本功能
async function modifyTextWithAI() {
    const instruction = document.getElementById('modifyInstruction').value.trim();
    const currentText = document.getElementById('extractEditTextarea').value.trim();

    if (!instruction) {
        alert('请输入修改指令！');
        return;
    }

    if (!currentText) {
        alert('没有可修改的文本！');
        return;
    }

    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

    const modifyBtn = document.getElementById('modifyTextBtn');
    const textarea = document.getElementById('extractEditTextarea');

    // 显示加载状态
    modifyBtn.disabled = true;
    modifyBtn.classList.add('loading');
    modifyBtn.textContent = '';

    try {
        // 构建提示词
        const prompt = `请对以下文本进行修改，修改要求：${instruction}。原文本：${currentText}。只输出修改后的文本，不要有任何额外说明。`;

        // 构建请求体
        const requestBody = {
            model: aiSettings.textModelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: false
        };

        // 调用API
        const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.textApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        if (data.choices && data.choices.length > 0) {
            const result = data.choices[0].message.content;
            textarea.value = result;
            document.getElementById('modifyInstruction').value = '';
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('文本修改失败:', error);
        alert(`修改失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        modifyBtn.disabled = false;
        modifyBtn.classList.remove('loading');
        modifyBtn.textContent = '修改';
    }
}

// ========== 提示词生成功能 ==========

// 生成提示词
async function generatePrompts(rowId, type) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const extractDisplay = row.querySelector('.extract-display');
    const extractResult = extractDisplay.textContent.trim();

    if (!extractResult || extractResult === '未提取') {
        alert('请先提取商品信息！');
        return;
    }

    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

    // 提取产品名称
    const productName = extractProductName(extractResult);

    // 选择模板
    const template = type === 'main' ? aiSettings.mainImageTemplate : aiSettings.aplusTemplate;

    // 验证模板是否存在
    if (!template) {
        alert('模板未配置！请先按J键在设置中配置模板。');
        return;
    }

    // 替换占位符
    const prompt = template
        .replace(/{product_name}/g, productName)
        .replace(/{extract_result}/g, extractResult);

    // 自动调整尺寸
    const sizeSelect = row.querySelector('.size-select');
    if (type === 'main') {
        // 主图设置为 1:1
        sizeSelect.value = '1:1';
    } else if (type === 'aplus') {
        // A+ 设置为 21:9
        sizeSelect.value = '21:9';
    }
    sizeSelect.dispatchEvent(new Event('change'));

    // 获取按钮
    const mainImageBtn = row.querySelector('.main-image-btn');
    const aplusBtn = row.querySelector('.aplus-btn');
    const targetBtn = type === 'main' ? mainImageBtn : aplusBtn;
    const otherBtn = type === 'main' ? aplusBtn : mainImageBtn;

    // 标记当前行正在生成提示词
    promptGeneratingRows.add(parseInt(rowId));

    // 显示加载状态，同时禁用另一个按钮
    const originalText = targetBtn.textContent;
    targetBtn.disabled = true;
    targetBtn.textContent = '生成提示词中...';
    otherBtn.disabled = true;

    try {
        // 调用 Deepseek API
        const requestBody = {
            model: aiSettings.textModelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: false
        };

        const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.textApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            const result = data.choices[0].message.content;

            // 更新状态：分析提示词
            targetBtn.textContent = '分析提示词中...';

            // 先让AI分析提示词结构
            const analyzedPrompts = await analyzePromptsWithAI(result, type);

            // 显示提示词模块
            displayPromptResults(row, analyzedPrompts, type);
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('提示词生成失败:', error);
        alert(`生成失败: ${error.message}`);
    } finally {
        // 移除生成状态标记
        promptGeneratingRows.delete(parseInt(rowId));

        // 恢复按钮状态
        targetBtn.disabled = false;
        targetBtn.textContent = originalText;

        // 检查提取结果状态，决定是否启用另一个按钮
        const currentRowId = parseInt(rowId);
        const status = rowExtractStatus.get(currentRowId);
        if (status === EXTRACT_STATUS.COMPLETED) {
            otherBtn.disabled = false;
        } else {
            otherBtn.disabled = true;
        }
    }
}

// 提取产品名称
function extractProductName(extractResult) {
    // 尝试从提取结果中找到产品名称
    const patterns = [
        /商品名称.*?中文[：:]\s*(.+?)(?:\n|商品英文名)/s,
        /Product Name.*?中文[：:]\s*(.+?)(?:\n|商品英文名)/s,
        /中文[：:]\s*(.+?)(?:\n|$)/
    ];

    for (const pattern of patterns) {
        const match = extractResult.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return '商品';
}

// 在原文中查找锚点位置（精确 + 模糊）
function findAnchorPosition(text, anchor) {
    if (!anchor) {
        return -1;
    }

    let pos = text.indexOf(anchor);
    if (pos !== -1) {
        return pos;
    }

    const normalizedText = text.replace(/\r\n/g, '\n');
    const normalizedAnchor = anchor.replace(/\r\n/g, '\n').trim();
    pos = normalizedText.indexOf(normalizedAnchor);
    if (pos !== -1) {
        return pos;
    }

    // 取锚点首行再试
    const firstLine = normalizedAnchor.split('\n')[0].trim();
    if (firstLine.length >= 8) {
        pos = normalizedText.indexOf(firstLine);
        if (pos !== -1) {
            return pos;
        }
    }

    return -1;
}

// 按 AI 返回的锚点从原文切片
function sliceTextByAnchors(text, anchors) {
    const sorted = anchors
        .map((item, idx) => ({
            index: typeof item.index === 'number' ? item.index : idx,
            title: item.title ? item.title.trim() : '',
            startText: item.startText ? item.startText.trim() : '',
            position: findAnchorPosition(text, item.startText)
        }))
        .filter(item => item.startText && item.position !== -1)
        .sort((a, b) => a.position - b.position);

    if (sorted.length === 0) {
        return [];
    }

    sorted.forEach((item, i) => {
        if (item.position === -1) {
            console.warn('AI锚点切分：找不到锚点', item.startText.substring(0, 60));
        }
    });

    const blocks = [];
    sorted.forEach((item, i) => {
        const start = item.position;
        const end = i < sorted.length - 1 ? sorted[i + 1].position : text.length;
        const content = text.substring(start, end).trim();
        if (content) {
            blocks.push({
                content,
                fallbackTitle: item.title || extractFallbackTitle(content, blocks.length),
                anchorTitle: item.title
            });
        }
    });

    return blocks;
}

// 解析 AI 返回的锚点 JSON
function parseAnchorJsonResponse(result) {
    let jsonText = result.trim();

    const jsonBlockMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1].trim();
    } else {
        const codeBlockMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonText = codeBlockMatch[1].trim();
        }
    }

    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        jsonText = arrayMatch[0];
    }

    jsonText = jsonText
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/,(\s*[}\]])/g, '$1')
        .trim();

    const anchors = JSON.parse(jsonText);
    if (!Array.isArray(anchors) || anchors.length === 0) {
        return null;
    }

    const isValid = anchors.every(item => item.startText);
    return isValid ? anchors : null;
}

// Deepseek 主导：识别提示词条数、标题与边界，正文从原文切片
async function extractPromptsWithDeepseek(text, type) {
    const expectedCount = type === 'main' ? 12 : type === 'aplus' ? 8 : null;
    const countHint = expectedCount
        ? `该文本为${type === 'main' ? '主图' : 'A+'}提示词，通常约 ${expectedCount} 条，但请以实际内容为准识别全部条目。`
        : '请识别文本中全部图片提示词条目。';

    const analysisPrompt = `你是一位专业的文本分析助手。请分析以下文本，识别其中包含多少条图片生成提示词，并为每条提取中文标题和起始锚点。

${countHint}

文本内容：
${text}

请严格按以下 JSON 格式返回，只需要标题和起始锚点，不要输出完整提示词正文：
[{"index": 0, "title": "简短中文标题", "startText": "该条提示词在原文开头的精确子串"}, {"index": 1, "title": "...", "startText": "..."}]

要求：
1. 只返回 JSON 数组，不要有任何其他文字
2. 识别并列出全部图片提示词，不要遗漏、合并任何一条
3. startText 必须从上述原文中逐字复制（通常取每条的第一行或标题行，20-80字符），用于定位切分点
4. index 从 0 开始，按原文顺序排列
5. title 为中文简短标题（不超过30字）
6. 不要修改 startText 中的任何字符`;

    const requestBody = {
        model: aiSettings.textModelName,
        messages: [{
            role: 'user',
            content: analysisPrompt
        }],
        stream: false
    };

    const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiSettings.textApiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Deepseek提示词提取请求失败: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
        throw new Error('Deepseek提示词提取返回格式错误');
    }

    const anchors = parseAnchorJsonResponse(data.choices[0].message.content);
    if (!anchors) {
        throw new Error('Deepseek提示词提取JSON解析失败');
    }

    const blocks = sliceTextByAnchors(text, anchors);
    if (blocks.length === 0) {
        throw new Error('Deepseek提示词提取未能从原文切片');
    }

    console.log('Deepseek提示词提取成功，共', blocks.length, '个提示词');
    return blocks;
}

// 从提示词块首行提取备用标题（仅用于 AI 标题生成失败时）
function extractFallbackTitle(content, index) {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) {
        return `提示词 ${index + 1}`;
    }

    let title = lines[0].trim();
    title = title.replace(/^(#{1,3}\s*|\*\*|【\s*(?:图|Image)\s*\d+\s*】\s*|Prompt\s*\d+\s*[：:：\-–—]?\s*|(?:Image|图)\s*\d+\s*[：:：\-–—]?\s*|第\s*\d+\s*张\s*|\d+\.\s+|\d+[、）)]\s*)/i, '').trim();
    title = title.replace(/(\*\*|#{1,3}|【|】)$/, '').trim();

    if (!title && lines.length > 1) {
        title = lines[1].trim();
        title = title.replace(/^(#{1,3}\s*|\*\*|【\s*(?:图|Image)\s*\d+\s*】\s*|Prompt\s*\d+\s*[：:：\-–—]?\s*|(?:Image|图)\s*\d+\s*[：:：\-–—]?\s*|第\s*\d+\s*张\s*|\d+\.\s+|\d+[、）)]\s*)/i, '').trim();
    }

    if (!title || title === '---' || title === '...') {
        return `提示词 ${index + 1}`;
    }

    if (title.length > 50) {
        title = title.substring(0, 50) + '...';
    }

    return title;
}

// 使用 Deepseek 分析提示词结构，正文从第一次 API 原文切片保留
async function analyzePromptsWithAI(text, type) {
    const blocks = await extractPromptsWithDeepseek(text, type);

    if (blocks.length === 0) {
        throw new Error('未能提取到任何提示词');
    }

    return blocks.map((block, index) => ({
        title: block.anchorTitle || block.fallbackTitle || `提示词 ${index + 1}`,
        content: block.content
    }));
}

// 显示提示词结果
function displayPromptResults(row, prompts, type) {
    const promptCell = row.querySelector('td:nth-child(5)'); // E列（提示词列）
    const promptContainer = promptCell.querySelector('.prompt-container');
    const rowId = row.dataset.rowId;

    // 查找 prompt-result-container
    let resultContainer = promptContainer.querySelector('.prompt-result-container');
    if (!resultContainer) {
        // 如果找不到，说明是旧数据，创建一个
        resultContainer = document.createElement('div');
        resultContainer.className = 'prompt-result-container';
        promptContainer.appendChild(resultContainer);
    }

    // 清空结果容器
    resultContainer.innerHTML = '';

    // 隐藏主图和A+按钮容器
    const promptButtonsContainer = promptContainer.querySelector('.prompt-buttons-container');
    if (promptButtonsContainer) {
        promptButtonsContainer.style.display = 'none';
    }

    // 隐藏手动输入按钮
    const promptInputBtn = promptContainer.querySelector('.prompt-input-btn');
    if (promptInputBtn) {
        promptInputBtn.style.display = 'none';
    }

    // 创建展开按钮
    const expandBtn = document.createElement('button');
    expandBtn.className = 'prompt-expand-btn';
    expandBtn.dataset.rowId = rowId;
    expandBtn.dataset.type = type;
    expandBtn.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${prompts.length}个) ▼`;

    // 存储提示词数据到按钮上
    expandBtn.promptsData = prompts;

    // 初始化勾选状态（如果不存在）
    if (!row.promptCheckStates) {
        row.promptCheckStates = {};
    }
    if (!row.promptCheckStates[type]) {
        // 默认全选
        row.promptCheckStates[type] = prompts.map((_, index) => true);
    }

    // 计算选中数量并更新按钮文本
    const selectedCount = row.promptCheckStates[type].filter(checked => checked).length;
    const totalCount = prompts.length;
    expandBtn.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${selectedCount}/${totalCount}) ▼`;

    // 点击展开/收起
    expandBtn.addEventListener('click', function() {
        // 从按钮读取最新的提示词数据
        const latestPrompts = expandBtn.promptsData;
        togglePromptExpand(row, latestPrompts, type);
    });

    resultContainer.appendChild(expandBtn);

    // 启用测试生成按钮（当提示词数量>=2时）
    const testGenerateBtn = row.querySelector('.test-generate-btn');
    if (testGenerateBtn && prompts.length >= 2) {
        testGenerateBtn.disabled = false;
    }
    scheduleSaveData();
}

// 更新提示词按钮文本（辅助函数）
function updatePromptButtonText(row, type) {
    const promptBtn = row.querySelector('.prompt-expand-btn');
    if (!promptBtn || !promptBtn.promptsData) return;

    const prompts = promptBtn.promptsData;
    const selectedCount = row.promptCheckStates[type] ? row.promptCheckStates[type].filter(checked => checked).length : prompts.length;
    const totalCount = prompts.length;
    const isExpanded = document.querySelector(`tr.prompt-expand-row[data-parent-row="${row.dataset.rowId}"]`);
    const arrow = isExpanded ? '▲' : '▼';

    promptBtn.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${selectedCount}/${totalCount}) ${arrow}`;
}

// 切换提示词展开/收起
function togglePromptExpand(row, prompts, type) {
    const rowId = row.dataset.rowId;
    const existingExpandRow = document.querySelector(`tr.prompt-expand-row[data-parent-row="${rowId}"]`);

    if (existingExpandRow) {
        // 如果已经展开，则收起
        existingExpandRow.remove();
        updatePromptButtonText(row, type);
    } else {
        // 展开提示词
        const expandRow = document.createElement('tr');
        expandRow.className = 'prompt-expand-row';
        expandRow.dataset.parentRow = rowId;

        const expandCell = document.createElement('td');
        expandCell.colSpan = 9;
        expandCell.className = 'prompt-expand-cell';

        const container = document.createElement('div');
        container.className = 'prompt-expand-container';

        const title = document.createElement('div');
        title.className = 'prompt-expand-title';

        const titleText = document.createElement('span');
        titleText.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${prompts.length}个)`;

        // 添加增加提示词的控件
        const addPromptControls = document.createElement('div');
        addPromptControls.className = 'add-prompt-controls';
        addPromptControls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: 15px;
        `;

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '1';
        countInput.max = '5';
        countInput.value = '1';
        countInput.className = 'add-prompt-count';
        countInput.style.cssText = `
            width: 50px;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
        `;

        const addPromptBtn = document.createElement('button');
        addPromptBtn.className = 'add-prompt-btn';
        addPromptBtn.textContent = '增加提示词';
        addPromptBtn.style.cssText = `
            padding: 4px 12px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        `;

        addPromptBtn.addEventListener('mouseover', function() {
            this.style.background = '#229954';
        });

        addPromptBtn.addEventListener('mouseout', function() {
            this.style.background = '#27ae60';
        });

        addPromptBtn.addEventListener('click', async function() {
            const count = parseInt(countInput.value) || 1;
            await generateAdditionalPrompts(row, type, prompts, count);
        });

        addPromptControls.appendChild(countInput);
        addPromptControls.appendChild(addPromptBtn);

        const selectButtons = document.createElement('div');
        selectButtons.className = 'prompt-select-buttons';

        const unselectAllBtn = document.createElement('button');
        unselectAllBtn.className = 'prompt-select-btn';
        unselectAllBtn.textContent = '取消全选';
        unselectAllBtn.addEventListener('click', function() {
            const checkboxes = grid.querySelectorAll('.prompt-card-checkbox');
            checkboxes.forEach((cb, idx) => {
                cb.checked = false;
                row.promptCheckStates[type][idx] = false;
            });
            updatePromptButtonText(row, type);
        });

        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'prompt-select-btn';
        selectAllBtn.textContent = '全选';
        selectAllBtn.addEventListener('click', function() {
            const checkboxes = grid.querySelectorAll('.prompt-card-checkbox');
            checkboxes.forEach((cb, idx) => {
                cb.checked = true;
                row.promptCheckStates[type][idx] = true;
            });
            updatePromptButtonText(row, type);
        });

        selectButtons.appendChild(unselectAllBtn);
        selectButtons.appendChild(selectAllBtn);
        title.appendChild(titleText);
        title.appendChild(addPromptControls);
        title.appendChild(selectButtons);

        const grid = document.createElement('div');
        grid.className = 'prompt-grid';

        prompts.forEach((prompt, index) => {
            const card = document.createElement('div');
            card.className = 'prompt-card';
            card.dataset.content = prompt.content;
            card.dataset.index = index;

            // 添加复选框
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'prompt-card-checkbox';
            // 从保存的状态中恢复勾选状态
            checkbox.checked = row.promptCheckStates[type][index];
            checkbox.dataset.index = index;

            // 阻止复选框点击事件冒泡到卡片，并保存状态
            checkbox.addEventListener('click', function(e) {
                e.stopPropagation();
                // 保存勾选状态
                row.promptCheckStates[type][index] = this.checked;
                // 更新按钮文本
                updatePromptButtonText(row, type);
            });

            const cardTitle = document.createElement('div');
            cardTitle.className = 'prompt-card-title';
            cardTitle.textContent = `${index + 1}. ${prompt.title}`;

            const cardPreview = document.createElement('div');
            cardPreview.className = 'prompt-card-preview';
            // 显示内容预览（前100个字符）
            const previewText = prompt.content.length > 100
                ? prompt.content.substring(0, 100) + '...'
                : prompt.content;
            cardPreview.textContent = previewText;

            // 添加状态标签
            const statusBadge = document.createElement('div');
            statusBadge.className = 'prompt-status-badge';
            statusBadge.dataset.promptType = type;
            statusBadge.dataset.promptIndex = index;

            // 检查该提示词的状态
            const status = getPromptStatus(row, type, index);
            if (status === 'generated') {
                statusBadge.textContent = '已生成';
                statusBadge.classList.add('status-generated');
            } else if (status === 'deleted') {
                statusBadge.textContent = '已删除';
                statusBadge.classList.add('status-deleted');
            } else {
                statusBadge.style.display = 'none';
            }

            card.appendChild(checkbox);
            card.appendChild(cardTitle);
            card.appendChild(cardPreview);
            card.appendChild(statusBadge);

            // 点击复制
            card.addEventListener('click', function() {
                copyToClipboard(prompt.content);
            });

            grid.appendChild(card);
        });

        container.appendChild(title);
        container.appendChild(grid);
        expandCell.appendChild(container);
        expandRow.appendChild(expandCell);

        // 插入到当前行下方
        row.parentNode.insertBefore(expandRow, row.nextSibling);

        // 更新按钮文本
        updatePromptButtonText(row, type);

        // 滚动到展开行
        setTimeout(() => {
            expandRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

        // 添加全局点击事件，点击外部区域关闭展开行
        setTimeout(() => {
            const closeHandler = function(e) {
                // 如果点击的是展开行内部或按钮本身，不关闭
                if (expandRow.contains(e.target) || btn.contains(e.target)) {
                    return;
                }

                // 点击外部区域，关闭展开行
                expandRow.remove();
                updatePromptButtonText(row, type);
                document.removeEventListener('click', closeHandler);
            };

            document.addEventListener('click', closeHandler);
        }, 100);
    }
}

// 获取提示词状态
function getPromptStatus(row, promptType, promptIndex) {
    if (!row.imagePromptMap || row.imagePromptMap.length === 0) {
        return 'none'; // 未生成
    }

    // 检查是否有该提示词生成的图片
    const hasGenerated = row.imagePromptMap.some(map =>
        map.promptType === promptType && map.promptIndex === promptIndex
    );

    if (!hasGenerated) {
        return 'none'; // 未生成
    }

    // 检查该提示词生成的图片是否还存在
    const stillExists = row.imagePromptMap.some(map =>
        map.promptType === promptType &&
        map.promptIndex === promptIndex &&
        row.historyImages.includes(map.imageUrl)
    );

    if (stillExists) {
        return 'generated'; // 已生成且图片还在
    } else {
        return 'deleted'; // 已生成但图片被删除
    }
}

// 更新提示词状态显示
function updatePromptStatus(row, promptType) {
    // 查找当前展开的提示词面板
    const rowId = row.dataset.rowId;
    const expandRow = document.querySelector(`tr.prompt-expand-row[data-parent-row="${rowId}"]`);

    if (!expandRow) {
        return; // 如果没有展开，不需要更新UI显示
    }

    // 更新所有提示词卡片的状态
    const statusBadges = expandRow.querySelectorAll('.prompt-status-badge');
    statusBadges.forEach(badge => {
        const type = badge.dataset.promptType;
        const index = parseInt(badge.dataset.promptIndex);

        if (type === promptType) {
            const status = getPromptStatus(row, type, index);

            // 移除所有状态类
            badge.classList.remove('status-generated', 'status-deleted');

            if (status === 'generated') {
                badge.textContent = '已生成';
                badge.classList.add('status-generated');
                badge.style.display = 'block';
            } else if (status === 'deleted') {
                badge.textContent = '已删除';
                badge.classList.add('status-deleted');
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    });

    // 同步更新checkbox的勾选状态
    const checkboxes = expandRow.querySelectorAll('.prompt-card-checkbox');
    checkboxes.forEach((checkbox, index) => {
        if (row.promptCheckStates && row.promptCheckStates[promptType]) {
            checkbox.checked = row.promptCheckStates[promptType][index];
        }
    });

    // 更新按钮文本
    updatePromptButtonText(row, promptType);
}

// 更新所有提示词的状态（当删除历史图片时调用）
function updateAllPromptStatus(row) {
    const rowId = row.dataset.rowId;
    const expandRow = document.querySelector(`tr.prompt-expand-row[data-parent-row="${rowId}"]`);

    if (!expandRow) {
        return;
    }

    const statusBadges = expandRow.querySelectorAll('.prompt-status-badge');
    statusBadges.forEach(badge => {
        const type = badge.dataset.promptType;
        const index = parseInt(badge.dataset.promptIndex);

        const status = getPromptStatus(row, type, index);

        badge.classList.remove('status-generated', 'status-deleted');

        if (status === 'generated') {
            badge.textContent = '已生成';
            badge.classList.add('status-generated');
            badge.style.display = 'block';
        } else if (status === 'deleted') {
            badge.textContent = '已删除';
            badge.classList.add('status-deleted');
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    });
}

// 生成额外的提示词
async function generateAdditionalPrompts(row, type, existingPrompts, count) {
    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

    // 获取按钮并显示加载状态
    const rowId = row.dataset.rowId;
    const expandRow = document.querySelector(`tr.prompt-expand-row[data-parent-row="${rowId}"]`);
    if (!expandRow) return;

    const addPromptBtn = expandRow.querySelector('.add-prompt-btn');
    const originalText = addPromptBtn.textContent;
    addPromptBtn.disabled = true;
    addPromptBtn.textContent = '生成中...';

    try {
        // 构建现有提示词的摘要
        const existingPromptsText = existingPrompts.map((p, i) =>
            `${i + 1}. ${p.title}\n${p.content.substring(0, 200)}...`
        ).join('\n\n');

        // 构建提示词
        const prompt = `你是一位专业的亚马逊产品图片提示词生成专家。

现有的${type === 'main' ? '主图' : 'A+'}提示词如下：

${existingPromptsText}

请根据上述已有的提示词，生成 ${count} 个新的、与现有提示词风格一致、内容相关的${type === 'main' ? '主图' : 'A+'}提示词。

要求：
1. 新提示词应该与现有提示词形成系列，保持风格统一
2. 内容要有创新性，不要重复现有提示词
3. 保持专业性和实用性
4. 每个提示词都要详细、具体

请严格按照以下JSON格式返回结果，确保JSON格式正确，不要添加任何其他说明文字：
[
  {"title": "新提示词1的简短中文标题", "content": "新提示词1的完整英文内容"},
  {"title": "新提示词2的简短中文标题", "content": "新提示词2的完整英文内容"}
]

重要提示：
1. 只返回JSON数组，不要有任何其他文字
2. title字段必须是中文，简洁描述图片内容
3. content字段保持原文（通常是英文提示词）
4. 确保所有字符串都用双引号包裹
5. 确保JSON格式完全正确`;

        const requestBody = {
            model: aiSettings.textModelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: false
        };

        const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.textApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            let result = data.choices[0].message.content.trim();

            // 解析JSON
            try {
                // 提取 ```json 代码块
                const jsonBlockMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch) {
                    result = jsonBlockMatch[1].trim();
                }

                // 提取 ``` 代码块（不带json标记）
                if (!jsonBlockMatch) {
                    const codeBlockMatch = result.match(/```\s*([\s\S]*?)\s*```/);
                    if (codeBlockMatch) {
                        result = codeBlockMatch[1].trim();
                    }
                }

                // 提取第一个 [ 到最后一个 ] 之间的内容
                const arrayMatch = result.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    result = arrayMatch[0];
                }

                // 清理可能的问题字符
                result = result
                    .replace(/[\x00-\x1F\x7F]/g, '')
                    .replace(/,(\s*[}\]])/g, '$1')
                    .trim();

                const newPrompts = JSON.parse(result);

                // 验证格式
                if (Array.isArray(newPrompts) && newPrompts.length > 0) {
                    const isValid = newPrompts.every(p => p.title && p.content);
                    if (isValid) {
                        // 将新提示词添加到现有列表
                        const promptBtn = row.querySelector('.prompt-expand-btn');
                        if (promptBtn && promptBtn.promptsData) {
                            // 合并提示词
                            promptBtn.promptsData = [...promptBtn.promptsData, ...newPrompts];

                            // 更新勾选状态数组
                            if (!row.promptCheckStates) {
                                row.promptCheckStates = {};
                            }
                            if (!row.promptCheckStates[type]) {
                                row.promptCheckStates[type] = [];
                            }
                            // 为新提示词添加默认勾选状态（默认选中）
                            newPrompts.forEach(() => {
                                row.promptCheckStates[type].push(true);
                            });

                            // 关闭当前展开面板
                            expandRow.remove();
                            const btn = row.querySelector('.prompt-expand-btn');
                            btn.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${promptBtn.promptsData.length}个) ▼`;

                            // 重新展开显示
                            setTimeout(() => {
                                togglePromptExpand(row, promptBtn.promptsData, type);
                            }, 100);

                            alert(`成功生成 ${newPrompts.length} 个新提示词！`);
                            return;
                        }
                    }
                }

                throw new Error('AI返回的提示词格式不正确');

            } catch (e) {
                console.error('JSON解析失败:', e);
                console.log('原始返回内容:', result);
                throw new Error('解析AI返回结果失败，请重试');
            }
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('生成额外提示词失败:', error);
        alert(`生成失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        addPromptBtn.disabled = false;
        addPromptBtn.textContent = originalText;
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyToast();
        }).catch(err => {
            console.error('复制失败:', err);
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

// 备用复制方法
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
        showCopyToast();
    } catch (err) {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制');
    }

    document.body.removeChild(textarea);
}

// 显示复制提示
function showCopyToast(message) {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = message || '已复制';
    document.body.appendChild(toast);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, 1500);
}

// 更新行号
function updateRowNumbers() {
    const rows = document.querySelectorAll('#tableBody tr');
    let currentNumber = 1;
    rows.forEach((row) => {
        const rowNumberSpan = row.querySelector('.row-number');
        if (rowNumberSpan) {
            rowNumberSpan.textContent = currentNumber;
            currentNumber++;
        }
    });
    rowCount = rows.length;
}

// ========== 商品分析功能 ==========

// 商品参考大小分析
async function analyzeSizeWithAI() {
    const currentText = document.getElementById('extractEditTextarea').value.trim();

    if (!currentText) {
        alert('没有可分析的商品信息！');
        return;
    }

    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

    const sizeBtn = document.getElementById('analyzeSizeBtn');
    const textarea = document.getElementById('extractEditTextarea');

    // 显示加载状态
    sizeBtn.disabled = true;
    sizeBtn.classList.add('loading');

    try {
        // 构建提示词（仅使用文本，不使用图片）
        const prompt = `请根据以下商品信息，分析商品的大小，帮助AI图像生成模型正确理解如何使用这个商品，并提供一个生活中常见物品作为大小参照对比。

商品信息：
${currentText}

请以以下格式输出（简洁明了，中英文双语）：
1. 只输出与常见物体的大小类比，不要输出任何具体的尺寸数值（如厘米、英寸、米等）
2. 使用生活中容易理解的物品作为参照物

商品参考大小 (Product Size Reference)
中文：[用常见物品类比大小]
English: [Size comparison with common objects]`;

        // 构建请求体
        const requestBody = {
            model: aiSettings.textModelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: false
        };

        // 调用API
        const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.textApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        if (data.choices && data.choices.length > 0) {
            const result = data.choices[0].message.content;
            // 在文本框底部添加分析结果
            textarea.value = currentText + '\n\n' + result;
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('商品大小分析失败:', error);
        alert(`分析失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        sizeBtn.disabled = false;
        sizeBtn.classList.remove('loading');
    }
}

// 穿戴方式分析
async function analyzeWearingWithAI() {
    const currentText = document.getElementById('extractEditTextarea').value.trim();

    if (!currentText) {
        alert('没有可分析的商品信息！');
        return;
    }

    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

    const wearingBtn = document.getElementById('analyzeWearingBtn');
    const textarea = document.getElementById('extractEditTextarea');

    // 显示加载状态
    wearingBtn.disabled = true;
    wearingBtn.classList.add('loading');

    try {
        // 构建提示词（仅使用文本，不使用图片）
        const prompt = `请根据以下商品信息，简洁描述这个商品的穿戴方式，帮助AI图像生成模型正确理解如何使用这个商品。

商品信息：
${currentText}

请以以下格式输出（简洁明了，中英文双语）：

穿戴方式 (Wearing Method)
中文：[简洁描述穿戴方式]
English: [Brief description of wearing method]`;

        // 构建请求体
        const requestBody = {
            model: aiSettings.textModelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: false
        };

        // 调用API
        const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.textApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        if (data.choices && data.choices.length > 0) {
            const result = data.choices[0].message.content;
            // 在文本框底部添加分析结果
            textarea.value = currentText + '\n\n' + result;
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('穿戴方式分析失败:', error);
        alert(`分析失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        wearingBtn.disabled = false;
        wearingBtn.classList.remove('loading');
    }
}

// 使用方式分析
async function analyzeUsageWithAI() {
    const currentText = document.getElementById('extractEditTextarea').value.trim();

    if (!currentText) {
        alert('没有可分析的商品信息！');
        return;
    }

    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

    const usageBtn = document.getElementById('analyzeUsageBtn');
    const textarea = document.getElementById('extractEditTextarea');

    // 显示加载状态
    usageBtn.disabled = true;
    usageBtn.classList.add('loading');

    try {
        // 构建提示词（仅使用文本，不使用图片）
        const prompt = `根据以下商品信息，用一句话简洁描述这个商品的使用方法，帮助AI图像生成模型正确理解如何使用这个商品。

商品信息：
${currentText}

请以以下格式输出（仅一句话，中英文双语）：

使用方式 (Usage Method)
中文：[一句话描述使用方法和场景]
English: [One sentence describing usage method and scenario]`;

        // 构建请求体
        const requestBody = {
            model: aiSettings.textModelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: false
        };

        // 调用API
        const response = await fetch(`${aiSettings.textApiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.textApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        if (data.choices && data.choices.length > 0) {
            const result = data.choices[0].message.content;
            // 在文本框底部添加分析结果
            textarea.value = currentText + '\n\n' + result;
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('使用方式分析失败:', error);
        alert(`分析失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        usageBtn.disabled = false;
        usageBtn.classList.remove('loading');
    }
}

// ==================== 分组功能核心函数 ====================

// 创建分组
function createGroup(rowIds) {
    if (!rowIds || rowIds.length < 2) {
        console.warn('分组至少需要2个行');
        return null;
    }

    // 按序号排序
    rowIds.sort((a, b) => a - b);

    // 生成新的组ID
    groupIdCounter++;
    const groupId = groupIdCounter;

    // 分配固定的颜色索引
    groupColorIndex.set(groupId, nextColorIndex);
    nextColorIndex = (nextColorIndex + 1) % GROUP_COLORS.length;

    // 更新数据结构
    rowGroups.set(groupId, rowIds);
    rowIds.forEach(id => rowToGroup.set(id, groupId));

    // 初始化为收起状态
    groupExpandedState.set(groupId, false);

    // 调整DOM顺序：确保所有组员行在DOM中连续排列
    const tbody = document.getElementById('tableBody');
    const leaderRow = document.querySelector(`tr[data-row-id="${rowIds[0]}"]`);

    if (leaderRow) {
        let previousRow = leaderRow;
        // 将所有组员行移动到组长行下方，保持顺序
        for (let i = 1; i < rowIds.length; i++) {
            const memberRow = document.querySelector(`tr[data-row-id="${rowIds[i]}"]`);
            if (memberRow && memberRow !== previousRow.nextSibling) {
                // 将成员行移动到前一行的下方
                tbody.insertBefore(memberRow, previousRow.nextSibling);
            }
            previousRow = memberRow || previousRow;
        }
    }

    // 更新UI
    updateGroupUI(groupId);

    console.log(`创建分组 ${groupId}:`, rowIds);
    saveGroupState();
    scheduleSaveData();
    return groupId;
}

// 更新分组UI
function updateGroupUI(groupId) {
    const rowIds = rowGroups.get(groupId);
    if (!rowIds || rowIds.length === 0) return;

    const leaderRowId = rowIds[0]; // 序号最小的是组长
    const isExpanded = groupExpandedState.get(groupId);
    const groupColor = getGroupColor(groupId);

    // 更新组长行
    const leaderRow = document.querySelector(`tr[data-row-id="${leaderRowId}"]`);
    if (!leaderRow) return;

    const leaderNumberCell = leaderRow.querySelector('.row-number-cell');
    const leaderNumber = leaderRow.querySelector('.row-number');
    if (leaderNumber) {
        leaderNumber.classList.add('grouped', 'group-leader');
        leaderNumber.textContent = `${leaderRowId} (${rowIds.length})`;
        leaderNumber.dataset.groupCount = rowIds.length;
        leaderNumber.dataset.groupId = groupId;
        // 应用颜色
        leaderNumber.style.borderLeftColor = groupColor.main;
        leaderNumber.style.backgroundColor = groupColor.light;
    }
    if (leaderNumberCell) {
        leaderNumberCell.style.backgroundColor = groupColor.light;
    }

    // 处理组员行
    for (let i = 1; i < rowIds.length; i++) {
        const memberRow = document.querySelector(`tr[data-row-id="${rowIds[i]}"]`);
        if (memberRow) {
            const memberNumberCell = memberRow.querySelector('.row-number-cell');
            const memberNumber = memberRow.querySelector('.row-number');
            if (memberNumber) {
                memberNumber.classList.add('grouped', 'group-member');
                memberNumber.dataset.groupId = groupId;
                // 应用颜色
                memberNumber.style.borderLeftColor = groupColor.main;
                memberNumber.style.backgroundColor = groupColor.lighter;
            }
            if (memberNumberCell) {
                memberNumberCell.style.backgroundColor = groupColor.lighter;
            }
            // 根据展开状态显示/隐藏
            memberRow.style.display = isExpanded ? '' : 'none';
        }
    }

    // 移除旧的展开按钮行（如果存在）
    const oldExpandRow = document.querySelector(`.group-expand-row[data-group-id="${groupId}"]`);
    if (oldExpandRow) {
        oldExpandRow.remove();
    }

    // 创建展开按钮行
    const expandRow = document.createElement('tr');
    expandRow.className = 'group-expand-row';
    expandRow.dataset.groupId = groupId;

    const memberCount = rowIds.length - 1;
    const expandIcon = isExpanded ? '▲' : '▼';
    const expandText = isExpanded ? '收起组' : '展开组';

    expandRow.innerHTML = `
        <td class="group-expand-cell" style="text-align: center; background: ${groupColor.lighter}; border-bottom: 1px solid #ddd; border-left: 3px solid ${groupColor.main};">
            <button class="group-expand-btn" data-group-id="${groupId}" title="${expandText} (${memberCount}个成员)" style="background: ${groupColor.light}; border-color: ${groupColor.main};">
                <span class="expand-icon">${expandIcon}</span>
            </button>
        </td>
        <td colspan="8" style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">
            <button class="batch-prompt-btn" data-group-id="${groupId}" style="padding: 6px 12px; background: #95a5a6; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-right: 8px;">
                批量导入提示词
            </button>
            <button class="batch-generate-btn" data-group-id="${groupId}" style="padding: 6px 12px; background: #95a5a6; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-right: 8px;">
                批量生成
            </button>
            <button class="batch-download-btn" data-group-id="${groupId}" style="padding: 6px 12px; background: #95a5a6; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                批量下载
            </button>
        </td>
    `;

    // 插入到组长行或最后一个组员行的下方
    let insertAfterRow = leaderRow;
    if (isExpanded && rowIds.length > 1) {
        const lastMemberRow = document.querySelector(`tr[data-row-id="${rowIds[rowIds.length - 1]}"]`);
        if (lastMemberRow) {
            insertAfterRow = lastMemberRow;
        }
    }

    insertAfterRow.parentNode.insertBefore(expandRow, insertAfterRow.nextSibling);

    // 绑定展开按钮事件
    const expandBtn = expandRow.querySelector('.group-expand-btn');
    expandBtn.addEventListener('click', function() {
        toggleGroupExpand(groupId);
    });

    // 绑定批量导入提示词按钮事件
    const batchPromptBtn = expandRow.querySelector('.batch-prompt-btn');
    batchPromptBtn.addEventListener('click', function() {
        showBatchPromptModal(groupId);
    });

    // 绑定批量下载按钮事件
    const batchDownloadBtn = expandRow.querySelector('.batch-download-btn');
    batchDownloadBtn.addEventListener('click', function() {
        batchDownloadGroupImages(groupId, batchDownloadBtn);
    });

    // 绑定批量生成按钮事件
    const batchGenerateBtn = expandRow.querySelector('.batch-generate-btn');
    batchGenerateBtn.addEventListener('click', function() {
        batchGenerateGroupImages(groupId, batchGenerateBtn);
    });
}

// 切换分组展开/收起
function toggleGroupExpand(groupId) {
    const isExpanded = groupExpandedState.get(groupId);
    groupExpandedState.set(groupId, !isExpanded);
    updateGroupUI(groupId);
    saveGroupState();
}

// 展开分组
function expandGroup(groupId) {
    groupExpandedState.set(groupId, true);
    updateGroupUI(groupId);
}

// 收起分组
function collapseGroup(groupId) {
    groupExpandedState.set(groupId, false);
    updateGroupUI(groupId);
}

// 取消整个分组
function ungroupAll(groupId) {
    const rowIds = rowGroups.get(groupId);
    if (!rowIds || rowIds.length === 0) return;

    console.log(`取消分组 ${groupId}:`, rowIds);

    // 找到组长行的DOM位置
    const leaderRowId = rowIds[0];
    const leaderRow = document.querySelector(`tr[data-row-id="${leaderRowId}"]`);
    if (!leaderRow) return;

    const tbody = document.getElementById('tableBody');
    let insertPosition = leaderRow.nextSibling;

    // 移除展开按钮行
    const expandRow = document.querySelector(`.group-expand-row[data-group-id="${groupId}"]`);
    if (expandRow) {
        // 如果展开按钮行是下一个兄弟节点，更新插入位置
        if (insertPosition === expandRow) {
            insertPosition = expandRow.nextSibling;
        }
        expandRow.remove();
    }

    // 显示所有组员行，并按顺序插入到组长行下方
    for (let i = 1; i < rowIds.length; i++) {
        const memberRow = document.querySelector(`tr[data-row-id="${rowIds[i]}"]`);
        if (memberRow) {
            memberRow.style.display = '';

            // 插入到正确位置
            if (insertPosition) {
                tbody.insertBefore(memberRow, insertPosition);
            } else {
                tbody.appendChild(memberRow);
            }

            // 恢复样式
            const memberNumberCell = memberRow.querySelector('.row-number-cell');
            const memberNumber = memberRow.querySelector('.row-number');
            if (memberNumber) {
                memberNumber.classList.remove('grouped', 'group-leader', 'group-member');
                memberNumber.textContent = rowIds[i];
                delete memberNumber.dataset.groupCount;
                delete memberNumber.dataset.groupId;
                // 清除颜色样式
                memberNumber.style.borderLeftColor = '';
                memberNumber.style.backgroundColor = '';
            }
            if (memberNumberCell) {
                memberNumberCell.style.backgroundColor = '';
            }

            // 添加取消分组动画
            memberRow.classList.add('row-ungrouping');
            setTimeout(() => {
                memberRow.classList.remove('row-ungrouping');
            }, 500);
        }
    }

    // 恢复组长行的样式
    const leaderNumberCell = leaderRow.querySelector('.row-number-cell');
    const leaderNumber = leaderRow.querySelector('.row-number');
    if (leaderNumber) {
        leaderNumber.classList.remove('grouped', 'group-leader', 'group-member');
        leaderNumber.textContent = leaderRowId;
        delete leaderNumber.dataset.groupCount;
        delete leaderNumber.dataset.groupId;
        // 清除颜色样式
        leaderNumber.style.borderLeftColor = '';
        leaderNumber.style.backgroundColor = '';
    }
    if (leaderNumberCell) {
        leaderNumberCell.style.backgroundColor = '';
    }

    // 添加取消分组动画
    leaderRow.classList.add('row-ungrouping');
    setTimeout(() => {
        leaderRow.classList.remove('row-ungrouping');
    }, 500);

    // 清理数据结构
    rowIds.forEach(id => rowToGroup.delete(id));
    rowGroups.delete(groupId);
    groupExpandedState.delete(groupId);
    groupColorIndex.delete(groupId); // 清除颜色索引

    // 更新所有行的序号
    updateRowNumbers();
    saveGroupState();
    scheduleSaveData();
}

// 从组中移除单个行
// insertAbove: true=插入到组上方, false/undefined=插入到组下方（默认）
function removeFromGroup(rowId, groupId, insertAbove = false) {
    const rowIds = rowGroups.get(groupId);
    if (!rowIds) return;

    console.log(`从组 ${groupId} 中移除行 ${rowId}`);

    // 从组中移除该行
    const index = rowIds.indexOf(rowId);
    if (index > -1) {
        rowIds.splice(index, 1);
    }
    rowToGroup.delete(rowId);

    // 恢复该行的样式
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (row) {
        const numberCell = row.querySelector('.row-number-cell');
        const number = row.querySelector('.row-number');
        if (number) {
            number.classList.remove('grouped', 'group-leader', 'group-member');
            number.textContent = rowId;
            delete number.dataset.groupCount;
            delete number.dataset.groupId;
            // 清除颜色样式
            number.style.borderLeftColor = '';
            number.style.backgroundColor = '';
        }
        if (numberCell) {
            numberCell.style.backgroundColor = '';
        }
        row.style.display = '';

        // 根据 insertAbove 参数决定将行插入到组上方还是下方
        const tbody = document.getElementById('tableBody');

        if (insertAbove) {
            // 插入到组长行上方
            const leaderRowId = rowIds[0];
            const leaderRow = document.querySelector(`tr[data-row-id="${leaderRowId}"]`);
            if (leaderRow) {
                tbody.insertBefore(row, leaderRow);
            }
        } else {
            // 插入到组下方（展开按钮下方或组长行下方）
            const expandRow = document.querySelector(`.group-expand-row[data-group-id="${groupId}"]`);
            if (expandRow) {
                tbody.insertBefore(row, expandRow.nextSibling);
            } else {
                const leaderRowId = rowIds[0];
                const leaderRow = document.querySelector(`tr[data-row-id="${leaderRowId}"]`);
                if (leaderRow) {
                    tbody.insertBefore(row, leaderRow.nextSibling);
                }
            }
        }

        // 添加动画
        row.classList.add('row-ungrouping');
        setTimeout(() => {
            row.classList.remove('row-ungrouping');
        }, 500);
    }

    // 如果组只剩1个成员，解散整个组
    if (rowIds.length === 1) {
        ungroupAll(groupId);
        updateRowNumbers();
        return;
    }

    // 更新组的UI
    updateGroupUI(groupId);

    // 更新序号
    updateRowNumbers();
    saveGroupState();
    scheduleSaveData();
}

// 将单个未分组行添加到现有分组
function addRowToGroup(rowId, groupId) {
    const rowIds = rowGroups.get(groupId);
    if (!rowIds) {
        console.warn(`分组 ${groupId} 不存在`);
        return;
    }

    // 如果该行已经在组中，跳过
    if (rowToGroup.get(rowId) === groupId) {
        console.warn(`行 ${rowId} 已在分组 ${groupId} 中`);
        return;
    }

    // 如果该行在其他组中，先移除（防御性处理）
    const existingGroupId = rowToGroup.get(rowId);
    if (existingGroupId && existingGroupId !== groupId) {
        removeFromGroup(rowId, existingGroupId);
    }

    console.log(`将行 ${rowId} 添加到分组 ${groupId}`);

    // 添加到组的行ID数组并排序
    rowIds.push(rowId);
    rowIds.sort((a, b) => a - b);
    rowToGroup.set(rowId, groupId);

    // 调整DOM顺序：将所有组员行按排序后的顺序排列在组长下方
    const tbody = document.getElementById('tableBody');
    const leaderRowId = rowIds[0];
    const leaderRow = document.querySelector(`tr[data-row-id="${leaderRowId}"]`);
    if (leaderRow) {
        let previousRow = leaderRow;
        for (let i = 1; i < rowIds.length; i++) {
            const memberRow = document.querySelector(`tr[data-row-id="${rowIds[i]}"]`);
            if (memberRow && memberRow !== previousRow.nextSibling) {
                tbody.insertBefore(memberRow, previousRow.nextSibling);
            }
            previousRow = memberRow || previousRow;
        }
    }

    // 更新组UI
    updateGroupUI(groupId);
    updateRowNumbers();
    saveGroupState();
    scheduleSaveData();
}

// 合并两个行到一个组
function mergeRowsToGroup(sourceRowId, targetRowId) {
    const sourceGroupId = rowToGroup.get(sourceRowId);
    const targetGroupId = rowToGroup.get(targetRowId);

    if (!sourceGroupId && !targetGroupId) {
        // 情况1：两行都未分组 → 创建新组
        createGroup([sourceRowId, targetRowId]);
        return null;
    } else if (sourceGroupId && !targetGroupId) {
        // 情况2：源行已分组，目标行未分组 → 源行脱离原组，不与目标行合并
        // 判断目标行在组的相对位置：上方还是下方
        const sourceRowIds = rowGroups.get(sourceGroupId);
        const leaderRowId = sourceRowIds[0];
        const leaderRow = document.querySelector(`tr[data-row-id="${leaderRowId}"]`);
        const targetRow = document.querySelector(`tr[data-row-id="${targetRowId}"]`);
        // 如果目标行在组长上方（DOM位置在组长之前），则将源行插入到组上方
        const insertAbove = leaderRow && targetRow &&
            !!(targetRow.compareDocumentPosition(leaderRow) & Node.DOCUMENT_POSITION_FOLLOWING);
        removeFromGroup(sourceRowId, sourceGroupId, insertAbove);
        return null;
    } else if (!sourceGroupId && targetGroupId) {
        // 情况3：源行未分组，目标行已分组 → 将源行直接加入目标组
        addRowToGroup(sourceRowId, targetGroupId);
        return targetGroupId;
    } else {
        // 情况4：两行都已分组 → 弹出确认框后合并两个组
        if (sourceGroupId === targetGroupId) {
            return null; // 同组内不处理（drop handler 已处理位置交换）
        }

        if (!confirm('两个行分别属于不同的分组，确定要合并这两个分组吗？')) {
            return null; // 用户取消
        }

        const sourceRowIds = rowGroups.get(sourceGroupId);
        const targetRowIds = rowGroups.get(targetGroupId);
        const newGroupRowIds = [...new Set([...sourceRowIds, ...targetRowIds])];
        const shouldExpandNewGroup = groupExpandedState.get(sourceGroupId) || groupExpandedState.get(targetGroupId) || false;

        ungroupAll(sourceGroupId);
        ungroupAll(targetGroupId);

        const newGroupId = createGroup(newGroupRowIds);
        if (shouldExpandNewGroup && newGroupId) {
            groupExpandedState.set(newGroupId, true);
            updateGroupUI(newGroupId);
        }
        return newGroupId;
    }
}

// 合并多个行到一个组（多选拖拽）
function mergeMultipleRowsToGroup(sourceRowIds, targetRowId) {
    // 收集所有涉及的行ID
    let allRowIds = [...sourceRowIds];

    // 如果目标行不在源行列表中，添加它
    if (!allRowIds.includes(targetRowId)) {
        allRowIds.push(targetRowId);
    }

    // 收集所有涉及的组ID
    const involvedGroupIds = new Set();
    let shouldExpandNewGroup = false;
    allRowIds.forEach(rowId => {
        const groupId = rowToGroup.get(rowId);
        if (groupId) {
            involvedGroupIds.add(groupId);
            // 如果任何一个旧组是展开的，记录下来
            if (groupExpandedState.get(groupId)) {
                shouldExpandNewGroup = true;
            }
            // 将该组的所有成员也加入
            const groupRowIds = rowGroups.get(groupId);
            if (groupRowIds) {
                allRowIds.push(...groupRowIds);
            }
        }
    });

    // 去重
    allRowIds = [...new Set(allRowIds)];

    // 先解散所有涉及的组
    involvedGroupIds.forEach(groupId => {
        ungroupAll(groupId);
    });

    // 创建新组
    const newGroupId = createGroup(allRowIds);

    // 如果任何旧组是展开的，将新组设置为展开状态
    if (shouldExpandNewGroup && newGroupId) {
        groupExpandedState.set(newGroupId, true);
        updateGroupUI(newGroupId);
    }

    return newGroupId;
}

// 从范围创建分组
function createGroupFromRange(startRowId, endRowId) {
    const minId = Math.min(startRowId, endRowId);
    const maxId = Math.max(startRowId, endRowId);

    // 获取范围内的所有行ID
    const rangeRowIds = [];
    for (let i = minId; i <= maxId; i++) {
        const row = document.querySelector(`tr[data-row-id="${i}"]`);
        if (row) {
            rangeRowIds.push(i);
        }
    }

    if (rangeRowIds.length < 2) {
        alert('选择的范围内至少需要2个行才能分组');
        return null;
    }

    // 检查是否有已分组的行，如果有则先解散
    const groupsToDissolve = new Set();
    rangeRowIds.forEach(id => {
        const groupId = rowToGroup.get(id);
        if (groupId) {
            groupsToDissolve.add(groupId);
        }
    });

    groupsToDissolve.forEach(groupId => {
        ungroupAll(groupId);
    });

    // 创建新组
    return createGroup(rangeRowIds);
}

// 显示分组右键菜单
function showGroupContextMenu(x, y, rowId, groupId) {
    const menu = document.getElementById('groupContextMenu');
    const rowIds = rowGroups.get(groupId);
    const isLeader = rowId === Math.min(...rowIds);
    const isExpanded = groupExpandedState.get(groupId);

    // 根据是否是组长显示不同选项
    const ungroupItem = menu.querySelector('[data-action="ungroup"]');
    const removeItem = menu.querySelector('[data-action="remove-from-group"]');
    const expandCollapseItem = menu.querySelector('[data-action="expand-collapse"]');
    const expandCollapseText = expandCollapseItem.querySelector('.expand-collapse-text');

    if (isLeader) {
        ungroupItem.style.display = 'flex';
        removeItem.style.display = 'none';
    } else {
        ungroupItem.style.display = 'none';
        removeItem.style.display = 'flex';
    }

    // 更新展开/收起文字
    expandCollapseText.textContent = isExpanded ? '收起组' : '展开组';

    // 显示菜单
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';

    // 绑定点击事件（移除旧的事件监听器）
    const newMenu = menu.cloneNode(true);
    menu.parentNode.replaceChild(newMenu, menu);

    newMenu.style.left = x + 'px';
    newMenu.style.top = y + 'px';
    newMenu.style.display = 'block';

    newMenu.onclick = function(e) {
        const action = e.target.closest('.context-menu-item')?.dataset.action;
        if (action === 'ungroup') {
            ungroupAll(groupId);
        } else if (action === 'remove-from-group') {
            removeFromGroup(rowId, groupId);
        } else if (action === 'expand-collapse') {
            toggleGroupExpand(groupId);
        }
        hideGroupContextMenu();
    };
}

// 隐藏分组右键菜单
function hideGroupContextMenu() {
    const menu = document.getElementById('groupContextMenu');
    if (menu) {
        menu.style.display = 'none';
    }
}

// ========== 其他功能 ==========

let currentBatchPromptGroupId = null;

// 快捷提示词模板 - 默认模板
const DEFAULT_QUICK_TEMPLATES = {
    'reconstruct-en': {
        name: '原图重构（英文）',
        icon: '🔄',
        content: `在不改变原始图片中的任何文字内容、信息结构和语义的前提下，对画面进行重新排版设计。
保持所有文字完整且不增删，不修改措辞。
调整布局结构、对齐方式、层级关系、模块划分和留白比例，使整体视觉呈现与原图明显不同，同时保持简洁、干净、专业的电商风格。
不添加大面积色块、额外图形装饰或点缀，避免干扰商品信息。
保证可读性与视觉层次感，形成新的版式风格，但信息内容完全一致。`
    },
    'reconstruct-cn': {
        name: '原图重构（中文）',
        icon: '🌐',
        content: `在不改变原始图片中任何信息结构和语义的前提下，先将图片中所有文字内容完整、准确地翻译成英文。
翻译时必须覆盖图片中出现的每一个文字元素，确保没有中文残留。
在翻译完成后，基于英文文本对画面进行重新排版设计：

保持所有文字完整且不增删，不修改措辞（仅允许根据英文排版需求进行轻微格式调整，如换行或段落对齐）。
调整布局结构、对齐方式、层级关系、模块划分和留白比例，使整体视觉呈现与原图明显不同，同时保持简洁、干净、专业的电商风格。
不添加大面积色块、额外图形装饰或点缀，避免干扰商品信息。
保证可读性与视觉层次感，形成新的版式风格，但信息内容完全一致。
最后，请在输出前逐一检查所有文字，确保图片中的每条文字都已被翻译为英文，绝不保留中文。`
    },
    'resize-4-3': {
        name: '调整普通A+尺寸（4:3）',
        icon: '📐',
        content: `图片尺寸比例转化为4:3`
    }
};

// 从LocalStorage加载快捷提示词模板
function loadQuickTemplates() {
    const saved = localStorage.getItem('quickTemplates');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('加载快捷提示词模板失败:', e);
        }
    }
    return DEFAULT_QUICK_TEMPLATES;
}

// 保存快捷提示词模板到LocalStorage
function saveQuickTemplates(templates) {
    localStorage.setItem('quickTemplates', JSON.stringify(templates));
}

// 当前使用的模板
let BATCH_QUICK_TEMPLATES = loadQuickTemplates();

// 渲染快捷按钮
function renderQuickButtons() {
    const container = document.querySelector('.batch-prompt-body .analysis-buttons-container');
    if (!container) return;

    container.innerHTML = '';

    Object.entries(BATCH_QUICK_TEMPLATES).forEach(([key, template]) => {
        const btn = document.createElement('button');
        btn.className = 'analysis-btn batch-quick-btn';
        btn.dataset.template = key;
        btn.innerHTML = `
            <span class="analysis-btn-icon">${template.icon}</span>
            <span class="analysis-btn-text">${template.name}</span>
        `;
        btn.onclick = function() {
            const textarea = document.getElementById("batchPromptTextarea");
            textarea.value = template.content;
        };
        container.appendChild(btn);
    });
}

function showBatchPromptModal(groupId) {
    currentBatchPromptGroupId = groupId;
    document.getElementById("batchPromptModal").style.display = "flex";
    document.getElementById("batchPromptTextarea").value = "";
    document.getElementById("batchModelSelect").value = "";
    document.getElementById("batchRatioSelect").value = "";

    // 渲染快捷按钮
    renderQuickButtons();
}

function closeBatchPromptModal() {
    document.getElementById("batchPromptModal").style.display = "none";
    currentBatchPromptGroupId = null;
}

function confirmBatchPrompt() {
    const promptText = document.getElementById("batchPromptTextarea").value.trim();
    const selectedModel = document.getElementById("batchModelSelect").value;
    const selectedRatio = document.getElementById("batchRatioSelect").value;

    if (!currentBatchPromptGroupId) return;

    const rowIds = rowGroups.get(currentBatchPromptGroupId);
    if (!rowIds) return;

    rowIds.forEach(rowId => {
        const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
        if (!row) return;

        // 应用提示词
        if (promptText) {
            const promptInputBtn = row.querySelector(".prompt-input-btn");
            const promptDisplay = row.querySelector(".prompt-display");
            const promptButtonsContainer = row.querySelector(".prompt-buttons-container");

            if (promptInputBtn) promptInputBtn.style.display = "none";
            if (promptButtonsContainer) promptButtonsContainer.style.display = "none";
            if (promptDisplay) {
                promptDisplay.textContent = promptText;
                promptDisplay.style.display = "block";
            }
        }

        // 应用模型选择
        if (selectedModel) {
            const modelSelect = row.querySelector(".model-select");
            if (modelSelect) modelSelect.value = selectedModel;
        }

        // 应用尺寸选择
        if (selectedRatio) {
            const sizeSelect = row.querySelector(".size-select");
            if (sizeSelect) sizeSelect.value = selectedRatio;
        }
    });

    closeBatchPromptModal();
}

// ========== 快捷提示词设置弹窗 ==========

// 显示快捷提示词设置弹窗
function showQuickTemplateSettingsModal() {
    document.getElementById('quickTemplateSettingsModal').style.display = 'flex';
    renderTemplateList();
}

// 关闭快捷提示词设置弹窗
function closeQuickTemplateSettingsModal() {
    document.getElementById('quickTemplateSettingsModal').style.display = 'none';
}

// 渲染模板列表
function renderTemplateList() {
    const templateList = document.getElementById('templateList');
    templateList.innerHTML = '';

    Object.entries(BATCH_QUICK_TEMPLATES).forEach(([key, template]) => {
        const item = document.createElement('div');
        item.className = 'template-item';
        item.dataset.key = key;

        // 判断是否为默认预设
        const isDefault = DEFAULT_QUICK_TEMPLATES.hasOwnProperty(key);

        item.innerHTML = `
            <div class="template-item-header">
                <input type="text" class="template-name-input" value="${template.name}" placeholder="模板名称">
                <div class="template-item-actions">
                    ${isDefault ? '<span class="default-badge">默认</span>' : '<button class="template-delete-btn">删除</button>'}
                </div>
            </div>
            <div class="template-item-body">
                <textarea class="template-content-textarea" placeholder="提示词内容">${template.content}</textarea>
            </div>
        `;

        // 只为自定义预设绑定删除按钮
        if (!isDefault) {
            const deleteBtn = item.querySelector('.template-delete-btn');
            deleteBtn.addEventListener('click', function() {
                if (confirm('确定要删除这个预设吗？')) {
                    delete BATCH_QUICK_TEMPLATES[key];
                    renderTemplateList();
                }
            });
        }

        templateList.appendChild(item);
    });
}

// 显示添加新模板弹窗
function showAddTemplateModal() {
    document.getElementById('addTemplateModal').style.display = 'flex';
    document.getElementById('newTemplateName').value = '';
    document.getElementById('newTemplateContent').value = '';
}

// 关闭添加新模板弹窗
function closeAddTemplateModal() {
    document.getElementById('addTemplateModal').style.display = 'none';
}

// 确认添加新模板
function confirmAddTemplate() {
    const name = document.getElementById('newTemplateName').value.trim();
    const content = document.getElementById('newTemplateContent').value.trim();

    if (!name) {
        alert('请输入预设名称！');
        return;
    }

    if (!content) {
        alert('请输入提示词内容！');
        return;
    }

    // 生成唯一key
    const key = 'custom-' + Date.now();

    BATCH_QUICK_TEMPLATES[key] = {
        name: name,
        icon: '📝',
        content: content
    };

    renderTemplateList();
    closeAddTemplateModal();
}

// 保存快捷提示词设置
function saveQuickTemplateSettings() {
    const templateItems = document.querySelectorAll('.template-item');
    const newTemplates = {};

    templateItems.forEach(item => {
        const key = item.dataset.key;
        const name = item.querySelector('.template-name-input').value.trim();
        const content = item.querySelector('.template-content-textarea').value.trim();

        if (name && content) {
            newTemplates[key] = {
                name: name,
                icon: BATCH_QUICK_TEMPLATES[key]?.icon || '📝',
                content: content
            };
        }
    });

    BATCH_QUICK_TEMPLATES = newTemplates;
    saveQuickTemplates(BATCH_QUICK_TEMPLATES);
    closeQuickTemplateSettingsModal();

    // 重新渲染快捷按钮（如果批量导入弹窗是打开的）
    const batchPromptModal = document.getElementById('batchPromptModal');
    if (batchPromptModal && batchPromptModal.style.display === 'flex') {
        renderQuickButtons();
    }

    alert('快捷提示词设置已保存！');
}

// 批量下载组内图片
async function batchDownloadGroupImages(groupId, button) {
    const rowIds = rowGroups.get(groupId);
    if (!rowIds || rowIds.length === 0) return;

    const originalText = button.textContent;
    let downloadCount = 0;
    let totalCount = 0;

    // 统计有下载按钮的行数
    rowIds.forEach(rowId => {
        const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
        if (!row) return;
        const downloadBtn = row.querySelector('.history-download-btn');
        if (downloadBtn && downloadBtn.style.display !== 'none') {
            totalCount++;
        }
    });

    if (totalCount === 0) {
        alert('组内没有可下载的图片！');
        return;
    }

    button.disabled = true;

    // 依次下载每个行的图片
    for (let i = 0; i < rowIds.length; i++) {
        const rowId = rowIds[i];
        const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
        if (!row) continue;

        const downloadBtn = row.querySelector('.history-download-btn');
        if (downloadBtn && downloadBtn.style.display !== 'none') {
            downloadCount++;
            button.textContent = `下载中... (${downloadCount}/${totalCount})`;

            // 调用下载函数（会自动应用尺寸调整）
            await downloadHistoryImages(row);

            // 等待1秒后继续下一个
            if (downloadCount < totalCount) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    button.textContent = '下载完成';
    setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 2000);
}

// 批量生成组内图片
async function batchGenerateGroupImages(groupId, button) {
    const rowIds = rowGroups.get(groupId);
    if (!rowIds || rowIds.length === 0) return;

    const originalText = button.textContent;
    let totalCount = 0;

    // 统计有生成按钮的行数
    const validRows = [];
    rowIds.forEach(rowId => {
        const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
        if (!row) return;
        const generateBtn = row.querySelector('.generate-btn');
        if (generateBtn && !generateBtn.disabled) {
            validRows.push({ rowId, row, generateBtn });
            totalCount++;
        }
    });

    if (totalCount === 0) {
        alert('组内没有可生成的行！');
        return;
    }

    // 添加确认提示
    if (!confirm(`确定要批量生成 ${totalCount} 个图片吗？\n\n这将连续发送 ${totalCount} 个API请求。`)) {
        return;
    }

    button.disabled = true;
    button.textContent = `准备生成... (0/${totalCount})`;

    // 立即连续触发所有生成（使用批量模式，不显示提醒）
    let triggeredCount = 0;
    const generatePromises = [];

    for (const { rowId, generateBtn } of validRows) {
        // 调用 generateImage 并传入 isBatchMode = true
        const promise = generateImage(rowId, true);
        generatePromises.push(promise);

        triggeredCount++;
        button.textContent = `已发送请求 (${triggeredCount}/${totalCount})`;

        // 短暂延迟避免浏览器阻塞（50ms）
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    button.textContent = `等待生成完成... (${totalCount}个)`;

    // 等待所有生成完成
    await Promise.all(generatePromises);

    button.textContent = '生成完成';
    setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 2000);
}

// 等待生成完成的辅助函数
function waitForGeneration(generateBtn) {
    return new Promise((resolve) => {
        const originalText = generateBtn.textContent;

        // 检查按钮文本是否恢复到原始状态
        const checkInterval = setInterval(() => {
            if (generateBtn.textContent === originalText || generateBtn.textContent === '生成') {
                clearInterval(checkInterval);
                resolve();
            }
        }, 500);

        // 设置超时（最多等待2分钟）
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 120000);
    });
}

// ==================== 水印功能 ====================

// 水印弹窗相关变量
let watermarkImage = null;

function loadWatermarkImage() {
    const saved = localStorage.getItem(WATERMARK_IMAGE_KEY);
    if (saved) {
        watermarkImage = saved;
        displayWatermarkPreview(watermarkImage);
    }
}

function saveWatermarkImage() {
    if (watermarkImage) {
        try {
            localStorage.setItem(WATERMARK_IMAGE_KEY, watermarkImage);
        } catch (e) {
            console.warn('水印图片保存失败:', e);
        }
    }
}

function compositeWatermarkOnImage(imageUrl, watermarkDataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const wm = new Image();
        img.crossOrigin = 'anonymous';
        wm.crossOrigin = 'anonymous';

        let loaded = 0;
        const onError = () => reject(new Error('图片加载失败'));

        const tryDraw = () => {
            loaded++;
            if (loaded < 2) return;

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const wmMaxWidth = canvas.width * 0.22;
            const wmScale = wmMaxWidth / wm.naturalWidth;
            const wmWidth = wm.naturalWidth * wmScale;
            const wmHeight = wm.naturalHeight * wmScale;
            const padding = Math.max(12, canvas.width * 0.02);
            const x = canvas.width - wmWidth - padding;
            const y = canvas.height - wmHeight - padding;

            ctx.globalAlpha = 0.85;
            ctx.drawImage(wm, x, y, wmWidth, wmHeight);
            ctx.globalAlpha = 1;

            resolve(canvas.toDataURL('image/png'));
        };

        img.onload = tryDraw;
        wm.onload = tryDraw;
        img.onerror = onError;
        wm.onerror = onError;
        img.src = imageUrl;
        wm.src = watermarkDataUrl;
    });
}

async function applyWatermarkToAllImages() {
    const targets = [];
    document.querySelectorAll('#tableBody tr[data-row-id]').forEach(row => {
        if (row.classList.contains('group-expand-row')) return;

        const resultDisplay = row.querySelector('.image-display');
        if (resultDisplay && !resultDisplay.classList.contains('empty')) {
            const img = resultDisplay.querySelector('img');
            if (img && img.src) targets.push({ row, type: 'result', imgEl: img });
        }

        if (row.historyImages && row.historyImages.length > 0) {
            row.historyImages.forEach((url, index) => {
                targets.push({ row, type: 'history', index, url });
            });
        }
    });

    if (targets.length === 0) {
        alert('没有找到可添加水印的图片，请先生成结果图或历史图。');
        return 0;
    }

    let successCount = 0;
    for (const item of targets) {
        try {
            const sourceUrl = item.type === 'result' ? item.imgEl.src : item.url;
            const watermarked = await compositeWatermarkOnImage(sourceUrl, watermarkImage);

            if (item.type === 'result') {
                item.imgEl.src = watermarked;
                const resultDisplay = item.row.querySelector('.image-display');
                if (resultDisplay) resultDisplay.classList.remove('empty');
            } else {
                item.row.historyImages[item.index] = watermarked;
                const thumbnails = item.row.querySelectorAll('.history-thumbnail img');
                if (thumbnails[item.index]) thumbnails[item.index].src = watermarked;
                const resultDisplay = item.row.querySelector('.image-display');
                const resultImg = resultDisplay && resultDisplay.querySelector('img');
                if (resultImg && resultImg.src === sourceUrl) {
                    resultImg.src = watermarked;
                }
            }
            successCount++;
        } catch (err) {
            console.error('水印处理失败:', err);
        }
    }

    scheduleSaveData();
    return successCount;
}

// 初始化水印功能
function initWatermarkFeature() {
    loadWatermarkImage();
    const watermarkBtn = document.getElementById('watermarkBtn');
    const watermarkModal = document.getElementById('watermarkModal');
    const closeWatermarkBtn = document.getElementById('closeWatermarkBtn');
    const watermarkImportArea = document.querySelector('.watermark-import-area');
    const watermarkImageInput = document.getElementById('watermarkImageInput');
    const importWatermarkImageBtn = document.getElementById('importWatermarkImageBtn');
    const applyWatermarkBtn = document.getElementById('applyWatermarkBtn');
    const watermarkPreviewArea = document.querySelector('.watermark-preview-area');

    // 打开水印弹窗
    watermarkBtn.addEventListener('click', () => {
        watermarkModal.style.display = 'flex';
    });

    // 关闭水印弹窗
    closeWatermarkBtn.addEventListener('click', () => {
        watermarkModal.style.display = 'none';
    });

    // 点击背景关闭弹窗
    watermarkModal.addEventListener('click', (e) => {
        if (e.target === watermarkModal) {
            watermarkModal.style.display = 'none';
        }
    });

    // 点击导入区域触发文件选择
    watermarkImportArea.addEventListener('click', () => {
        watermarkImageInput.click();
    });

    // 点击导入图片按钮
    importWatermarkImageBtn.addEventListener('click', () => {
        watermarkImageInput.click();
    });

    // 拖拽上传
    watermarkImportArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        watermarkImportArea.style.borderColor = '#2196F3';
        watermarkImportArea.style.background = '#f0f8ff';
    });

    watermarkImportArea.addEventListener('dragleave', () => {
        watermarkImportArea.style.borderColor = '#ddd';
        watermarkImportArea.style.background = '#fafafa';
    });

    watermarkImportArea.addEventListener('drop', (e) => {
        e.preventDefault();
        watermarkImportArea.style.borderColor = '#ddd';
        watermarkImportArea.style.background = '#fafafa';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleWatermarkImageUpload(files[0]);
        }
    });

    // 文件选择
    watermarkImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleWatermarkImageUpload(file);
        }
    });

    applyWatermarkBtn.addEventListener('click', async () => {
        if (!watermarkImage) {
            alert('请先导入水印图片！');
            return;
        }
        applyWatermarkBtn.disabled = true;
        applyWatermarkBtn.textContent = '处理中...';
        try {
            const count = await applyWatermarkToAllImages();
            if (count > 0) {
                showCopyToast(`已为 ${count} 张图片添加水印`);
            }
        } finally {
            applyWatermarkBtn.disabled = false;
            applyWatermarkBtn.textContent = '一键添加水印';
        }
    });
}

// 处理水印图片上传
function handleWatermarkImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件！');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        watermarkImage = e.target.result;
        displayWatermarkPreview(watermarkImage);
        saveWatermarkImage();
    };
    reader.readAsDataURL(file);
}

// 显示水印预览
function displayWatermarkPreview(imageData) {
    const watermarkPreviewArea = document.querySelector('.watermark-preview-area');
    watermarkPreviewArea.innerHTML = `
        <img src="${imageData}" class="watermark-preview-image" alt="水印预览">
    `;
}

// ==================== 拆分功能 ====================
function initSplitFeature() {
    const splitBtn = document.getElementById('splitBtn');
    const splitModal = document.getElementById('splitModal');
    const closeSplitBtn = document.getElementById('closeSplitBtn');
    const splitUploadArea = document.getElementById('splitUploadArea');
    const splitImageInput = document.getElementById('splitImageInput');
    const splitPreviewArea = document.getElementById('splitPreviewArea');
    const splitCropToolbar = document.getElementById('splitCropToolbar');
    const splitPreviewImage = document.getElementById('splitPreviewImage');
    const splitUploadPlaceholder = document.querySelector('.split-upload-placeholder');
    const splitDeleteBtn = document.getElementById('splitDeleteBtn');
    const splitImageDimensions = document.getElementById('splitImageDimensions');
    const freeCropBtn = document.getElementById('freeCropBtn');
    const cropContainer = document.getElementById('splitCropContainer');
    const cropOverlay = document.getElementById('splitCropOverlay');
    const cropSelection = document.getElementById('splitCropSelection');
    const cropActions = document.getElementById('splitCropActions');
    const confirmCropBtn = document.getElementById('confirmCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const resultsArea = document.getElementById('splitResultsArea');
    const resultsGallery = document.getElementById('splitResultsGallery');
    const splitDownloadAllBtn = document.getElementById('splitDownloadAllBtn');
    const splitDownload1600Btn = document.getElementById('splitDownload1600Btn');
    const splitClearAllBtn = document.getElementById('splitClearAllBtn');
    const splitImportBtn = document.getElementById('splitImportBtn');

    // 比例按钮
    const ratio11Btn = document.getElementById('ratio11Btn');
    const ratio219Btn = document.getElementById('ratio219Btn');

    // 裁剪状态
    let cropMode = false;
    let aspectRatio = null; // null | 1 | 21/9
    let cropStartX, cropStartY;
    let cropRect = { left: 0, top: 0, width: 0, height: 0 };
    let isDrawing = false;
    let draggingHandle = null;
    let dragStartRect = null;
    let dragStartX, dragStartY;

    // 存储所有裁剪结果
    let cropResults = [];
    let zoomScale = 1;

    function resetCropState() {
        cropMode = false;
        aspectRatio = null;
        isDrawing = false;
        draggingHandle = null;
        cropRect = { left: 0, top: 0, width: 0, height: 0 };
        cropSelection.style.display = 'none';
        cropSelection.style.left = '0px';
        cropSelection.style.top = '0px';
        cropSelection.style.width = '0px';
        cropSelection.style.height = '0px';
        cropOverlay.style.display = 'none';
        cropActions.style.display = 'none';
        freeCropBtn.textContent = '自由裁剪';
        freeCropBtn.classList.remove('active');
        ratio11Btn.classList.remove('active');
        ratio219Btn.classList.remove('active');
    }

    function renderCropResults() {
        resultsGallery.innerHTML = '';
        cropResults.forEach((dataUrl, index) => {
            const item = document.createElement('div');
            item.className = 'split-result-item';
            item.setAttribute('draggable', 'true');
            item.dataset.index = index;
            item.innerHTML = `<img src="${dataUrl}" alt="裁剪结果${index + 1}">`;
            // 点击放大查看
            item.addEventListener('click', () => {
                showCropResultViewer(index);
            });
            // 拖拽排序
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index.toString());
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                resultsGallery.querySelectorAll('.split-result-item').forEach(el => {
                    el.classList.remove('drag-over');
                });
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                if (fromIndex === toIndex) return;
                const [movedItem] = cropResults.splice(fromIndex, 1);
                cropResults.splice(toIndex, 0, movedItem);
                renderCropResults();
            });
            const delBtn = document.createElement('button');
            delBtn.className = 'split-result-delete-btn';
            delBtn.textContent = '×';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                cropResults.splice(index, 1);
                renderCropResults();
            });
            item.appendChild(delBtn);
            resultsGallery.appendChild(item);
        });
        if (cropResults.length > 0) {
            resultsArea.classList.add('has-results');
            splitDownloadAllBtn.style.display = 'inline-block';
            splitDownload1600Btn.style.display = 'inline-block';
            splitClearAllBtn.style.display = 'inline-block';
            splitImportBtn.style.display = 'inline-block';
        } else {
            resultsArea.classList.remove('has-results');
            splitDownloadAllBtn.style.display = 'none';
            splitDownload1600Btn.style.display = 'none';
            splitClearAllBtn.style.display = 'none';
            splitImportBtn.style.display = 'none';
        }
    }

    function showCropResultViewer(startIndex) {
        if (cropResults.length === 0) return;
        let currentIdx = startIndex;

        const viewer = document.createElement('div');
        viewer.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.92); display: flex; align-items: center;
            justify-content: center; z-index: 100000;
        `;

        const img = document.createElement('img');
        img.src = cropResults[currentIdx];
        img.style.cssText = 'max-width:90%; max-height:85vh; border-radius:8px; object-fit:contain;';
        viewer.appendChild(img);

        const counter = document.createElement('div');
        counter.textContent = `${currentIdx + 1} / ${cropResults.length}`;
        counter.style.cssText = 'position:fixed; bottom:40px; left:50%; transform:translateX(-50%); color:white; font-size:16px; font-weight:600; z-index:100001;';

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '◀';
        prevBtn.style.cssText = 'position:fixed; left:30px; top:50%; transform:translateY(-50%); width:48px; height:48px; background:rgba(255,255,255,0.2); color:white; border:none; border-radius:50%; font-size:20px; cursor:pointer; z-index:100001; transition:all 0.2s;';
        prevBtn.addEventListener('mouseover', () => { prevBtn.style.background = 'rgba(255,255,255,0.4)'; });
        prevBtn.addEventListener('mouseout', () => { prevBtn.style.background = 'rgba(255,255,255,0.2)'; });

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '▶';
        nextBtn.style.cssText = 'position:fixed; right:30px; top:50%; transform:translateY(-50%); width:48px; height:48px; background:rgba(255,255,255,0.2); color:white; border:none; border-radius:50%; font-size:20px; cursor:pointer; z-index:100001; transition:all 0.2s;';
        nextBtn.addEventListener('mouseover', () => { nextBtn.style.background = 'rgba(255,255,255,0.4)'; });
        nextBtn.addEventListener('mouseout', () => { nextBtn.style.background = 'rgba(255,255,255,0.2)'; });

        const importBtn = document.createElement('button');
        importBtn.innerHTML = '📥';
        importBtn.title = '导入到表格';
        importBtn.style.cssText = 'position:fixed; top:30px; right:84px; width:44px; height:44px; background:rgba(39,174,96,0.85); color:white; border:none; border-radius:50%; font-size:18px; cursor:pointer; z-index:100001; transition:all 0.2s; display:flex; align-items:center; justify-content:center;';
        importBtn.addEventListener('mouseover', () => { importBtn.style.background = 'rgba(39,174,96,1)'; });
        importBtn.addEventListener('mouseout', () => { importBtn.style.background = 'rgba(39,174,96,0.85)'; });
        importBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dataUrl = cropResults[currentIdx];
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `裁剪结果_${currentIdx + 1}.png`, { type: 'image/png' });

            const newRow = addRow(true);
            const productUploadArea = newRow.querySelector('.product-upload');
            const productPreview = newRow.querySelector('.product-preview');
            const productDeleteBtn = newRow.querySelector('.product-delete-btn');
            const productGalleryBtn = newRow.querySelector('.product-gallery-btn');
            const productFileInput = newRow.querySelector('.product-file-input');

            if (productUploadArea && productPreview) {
                newRow.productImages.push(dataUrl);
                productPreview.src = newRow.productImages[0];
                productUploadArea.classList.add('has-image');
                productDeleteBtn.style.display = 'block';
                productGalleryBtn.style.display = 'inline-block';
                productGalleryBtn.textContent = `展开 (${newRow.productImages.length}张)`;

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                productFileInput.files = dataTransfer.files;
            }

            const firstNewRow = document.querySelector(`tr[data-row-id="${newRow.dataset.rowId}"]`);
            if (firstNewRow) {
                firstNewRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = '⬇';
        downloadBtn.title = '下载';
        downloadBtn.style.cssText = 'position:fixed; top:30px; right:30px; width:44px; height:44px; background:rgba(76,175,80,0.85); color:white; border:none; border-radius:50%; font-size:20px; cursor:pointer; z-index:100001; transition:all 0.2s; display:flex; align-items:center; justify-content:center;';
        downloadBtn.addEventListener('mouseover', () => { downloadBtn.style.background = 'rgba(76,175,80,1)'; });
        downloadBtn.addEventListener('mouseout', () => { downloadBtn.style.background = 'rgba(76,175,80,0.85)'; });
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadImage(cropResults[currentIdx], `裁剪结果_${currentIdx + 1}.png`);
        });

        function updateView() {
            img.src = cropResults[currentIdx];
            counter.textContent = `${currentIdx + 1} / ${cropResults.length}`;
            prevBtn.style.display = cropResults.length > 1 ? 'block' : 'none';
            nextBtn.style.display = cropResults.length > 1 ? 'block' : 'none';
        }

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx - 1 + cropResults.length) % cropResults.length;
            updateView();
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx + 1) % cropResults.length;
            updateView();
        });

        viewer.addEventListener('click', () => viewer.remove());

        const keyHandler = (e) => {
            if (e.key === 'ArrowLeft') { currentIdx = (currentIdx - 1 + cropResults.length) % cropResults.length; updateView(); }
            if (e.key === 'ArrowRight') { currentIdx = (currentIdx + 1) % cropResults.length; updateView(); }
            if (e.key === 'Escape') { viewer.remove(); document.removeEventListener('keydown', keyHandler); }
        };
        document.addEventListener('keydown', keyHandler);

        viewer.appendChild(importBtn);
        viewer.appendChild(counter);
        viewer.appendChild(prevBtn);
        viewer.appendChild(nextBtn);
        viewer.appendChild(downloadBtn);
        document.body.appendChild(viewer);
        updateView();
    }

    function getImageRect() {
        const imgRect = splitPreviewImage.getBoundingClientRect();
        const containerRect = cropContainer.getBoundingClientRect();
        return {
            left: imgRect.left - containerRect.left,
            top: imgRect.top - containerRect.top,
            width: imgRect.width,
            height: imgRect.height
        };
    }

    // 打开拆分弹窗
    splitBtn.addEventListener('click', () => {
        splitModal.style.display = 'flex';
        // 根据是否已加载图片决定显示上传区还是预览区
        if (splitPreviewImage.src && splitPreviewImage.src !== window.location.href) {
            splitUploadArea.style.display = 'none';
            splitPreviewArea.style.display = 'flex';
            splitCropToolbar.style.display = 'flex';
        } else {
            splitUploadPlaceholder.style.display = '';
            splitUploadArea.style.display = '';
            splitPreviewArea.style.display = 'none';
            splitCropToolbar.style.display = 'none';
            splitUploadArea.style.borderColor = '#ddd';
            splitUploadArea.style.background = '#fafafa';
            resetCropState();
        }
        renderCropResults();
    });

    // 关闭拆分弹窗
    closeSplitBtn.addEventListener('click', () => {
        splitModal.style.display = 'none';
    });

    splitModal.addEventListener('click', (e) => {
        if (e.target === splitModal) {
            splitModal.style.display = 'none';
        }
    });

    // 上传
    splitUploadArea.addEventListener('click', () => splitImageInput.click());

    splitImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleSplitImageUpload(file);
            splitImageInput.value = '';
        }
    });

    splitUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        splitUploadArea.style.borderColor = '#FF9800';
        splitUploadArea.style.background = '#fff8f0';
    });

    splitUploadArea.addEventListener('dragleave', () => {
        splitUploadArea.style.borderColor = '#ddd';
        splitUploadArea.style.background = '#fafafa';
    });

    splitUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        splitUploadArea.style.borderColor = '#ddd';
        splitUploadArea.style.background = '#fafafa';
        const file = e.dataTransfer.files[0];
        if (file) handleSplitImageUpload(file);
    });

    // 删除图片，恢复上传区域
    splitDeleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        splitPreviewImage.src = '';
        splitPreviewImage.style.transform = '';
        zoomScale = 1;
        splitPreviewArea.style.display = 'none';
        splitCropToolbar.style.display = 'none';
        splitUploadArea.style.display = '';
        splitUploadPlaceholder.style.display = '';
        splitImageDimensions.style.display = 'none';
        resetCropState();
        renderCropResults();
    });

    // 进入裁剪模式的通用方法
    function enterCropMode(ratioKey) {
        if (!splitPreviewImage.src) return;
        // 根据 key 计算比例值：null/'free' → null, '1:1' → 1, '21:9' → 21/9
        const ratioValue = ratioKey === '1:1' ? 1 : ratioKey === '21:9' ? 21 / 9 : null;
        cropMode = true;
        aspectRatio = ratioValue;
        cropOverlay.style.display = 'block';
        // 清除当前选区
        cropSelection.style.display = 'none';
        cropActions.style.display = 'none';
        cropRect = { left: 0, top: 0, width: 0, height: 0 };
        isDrawing = false;
        draggingHandle = null;
        // 按钮状态
        ratio11Btn.classList.toggle('active', ratioKey === '1:1');
        ratio219Btn.classList.toggle('active', ratioKey === '21:9');
        if (ratioKey) {
            freeCropBtn.textContent = '取消';
            freeCropBtn.classList.add('active', 'cancel-mode');
        } else {
            freeCropBtn.textContent = '退出裁剪';
            freeCropBtn.classList.add('active');
            freeCropBtn.classList.remove('cancel-mode');
        }
    }

    function exitCropMode() {
        cropMode = false;
        aspectRatio = null;
        cropOverlay.style.display = 'none';
        cropSelection.style.display = 'none';
        cropActions.style.display = 'none';
        cropRect = { left: 0, top: 0, width: 0, height: 0 };
        isDrawing = false;
        draggingHandle = null;
        freeCropBtn.textContent = '自由裁剪';
        freeCropBtn.classList.remove('active', 'cancel-mode');
        ratio11Btn.classList.remove('active');
        ratio219Btn.classList.remove('active');
    }

    // 1:1 比例按钮
    ratio11Btn.addEventListener('click', () => {
        if (!splitPreviewImage.src) return;
        if (aspectRatio === 1) {
            exitCropMode();
        } else {
            enterCropMode('1:1');
        }
    });

    // 21:9 比例按钮
    ratio219Btn.addEventListener('click', () => {
        if (!splitPreviewImage.src) return;
        if (aspectRatio === 21 / 9) {
            exitCropMode();
        } else {
            enterCropMode('21:9');
        }
    });

    // 自由裁剪按钮
    freeCropBtn.addEventListener('click', () => {
        if (!splitPreviewImage.src) return;
        if (cropMode) {
            exitCropMode();
            return;
        }
        enterCropMode(null);
    });

    // 裁剪覆盖层鼠标事件
    cropOverlay.addEventListener('mousedown', (e) => {
        if (!cropMode) return;
        const imgRect = getImageRect();
        const mx = e.clientX - cropContainer.getBoundingClientRect().left;
        const my = e.clientY - cropContainer.getBoundingClientRect().top;

        // 检查是否点击了手柄
        const handleEl = e.target.closest('.crop-handle');
        if (handleEl && cropSelection.style.display !== 'none') {
            draggingHandle = handleEl.dataset.handle;
            dragStartRect = { ...cropRect };
            dragStartX = mx;
            dragStartY = my;
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // 检查是否在已有选区内点击（开始拖拽选区）
        if (cropSelection.style.display !== 'none' &&
            mx >= cropRect.left && mx <= cropRect.left + cropRect.width &&
            my >= cropRect.top && my <= cropRect.top + cropRect.height) {
            dragStartRect = { ...cropRect };
            dragStartX = mx;
            dragStartY = my;
            draggingHandle = 'move';
            e.preventDefault();
            return;
        }

        // 在图片范围内开始绘制新选区
        if (mx >= imgRect.left && mx <= imgRect.left + imgRect.width &&
            my >= imgRect.top && my <= imgRect.top + imgRect.height) {
            isDrawing = true;
            cropStartX = mx;
            cropStartY = my;
            cropRect = { left: mx, top: my, width: 0, height: 0 };
            cropSelection.style.display = 'block';
            cropActions.style.display = 'none';
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!cropMode) return;
        const mx = e.clientX - cropContainer.getBoundingClientRect().left;
        const my = e.clientY - cropContainer.getBoundingClientRect().top;

        if (isDrawing) {
            const imgRect = getImageRect();
            const rawLeft = Math.min(cropStartX, mx);
            const rawTop = Math.min(cropStartY, my);
            const rawRight = Math.max(cropStartX, mx);
            const rawBottom = Math.max(cropStartY, my);

            let rect = {
                left: Math.max(imgRect.left, rawLeft),
                top: Math.max(imgRect.top, rawTop),
                width: Math.min(imgRect.left + imgRect.width, rawRight) - Math.max(imgRect.left, rawLeft),
                height: Math.min(imgRect.top + imgRect.height, rawBottom) - Math.max(imgRect.top, rawTop)
            };
            rect.width = Math.max(0, rect.width);
            rect.height = Math.max(0, rect.height);

            if (aspectRatio) {
                // 以拖拽起点为固定锚点，根据鼠标方向等比扩展
                const dx = mx - cropStartX;
                const dy = my - cropStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                const r = aspectRatio;
                let w, h;
                if (absDx / absDy > r) {
                    w = absDx;
                    h = w / r;
                } else {
                    h = absDy;
                    w = h * r;
                }
                rect = {
                    left: dx >= 0 ? cropStartX : cropStartX - w,
                    top: dy >= 0 ? cropStartY : cropStartY - h,
                    width: w,
                    height: h
                };
                // clamp 到图片范围内
                rect.left = Math.max(imgRect.left, rect.left);
                rect.top = Math.max(imgRect.top, rect.top);
                rect.width = Math.min(imgRect.left + imgRect.width - rect.left, rect.width);
                rect.height = Math.min(imgRect.top + imgRect.height - rect.top, rect.height);
            }

            cropRect = rect;
            updateCropSelectionUI();
        } else if (draggingHandle) {
            const imgRect = getImageRect();
            if (draggingHandle === 'move') {
                const dx = mx - dragStartX;
                const dy = my - dragStartY;
                let newLeft = dragStartRect.left + dx;
                let newTop = dragStartRect.top + dy;
                newLeft = Math.max(imgRect.left, Math.min(newLeft, imgRect.left + imgRect.width - dragStartRect.width));
                newTop = Math.max(imgRect.top, Math.min(newTop, imgRect.top + imgRect.height - dragStartRect.height));
                cropRect = { left: newLeft, top: newTop, width: dragStartRect.width, height: dragStartRect.height };
            } else if (aspectRatio) {
                // 有比例锁定时，基于对角手柄计算新尺寸
                let newRect = { ...dragStartRect };
                switch (draggingHandle) {
                    case 'br':
                        newRect.width = Math.max(10, mx - dragStartRect.left);
                        break;
                    case 'tl':
                        newRect.left = Math.max(imgRect.left, Math.min(mx, dragStartRect.left + dragStartRect.width - 10));
                        newRect.width = dragStartRect.left + dragStartRect.width - newRect.left;
                        break;
                    case 'tr':
                        newRect.width = Math.max(10, mx - dragStartRect.left);
                        break;
                    case 'bl':
                        newRect.left = Math.max(imgRect.left, Math.min(mx, dragStartRect.left + dragStartRect.width - 10));
                        newRect.width = dragStartRect.left + dragStartRect.width - newRect.left;
                        break;
                }
                newRect.height = newRect.width / aspectRatio;
                // 根据手柄调整 top
                switch (draggingHandle) {
                    case 'br':
                    case 'tr':
                        newRect.top = dragStartRect.top;
                        break;
                    case 'tl':
                    case 'bl':
                        newRect.top = dragStartRect.top + dragStartRect.height - newRect.height;
                        break;
                }
                // clamp
                newRect.left = Math.max(imgRect.left, newRect.left);
                newRect.top = Math.max(imgRect.top, newRect.top);
                newRect.width = Math.min(newRect.width, imgRect.left + imgRect.width - newRect.left);
                newRect.height = Math.min(newRect.height, imgRect.top + imgRect.height - newRect.top);
                // 再次按比例调整确保一致
                if (newRect.width / newRect.height > aspectRatio) {
                    newRect.width = newRect.height * aspectRatio;
                } else {
                    newRect.height = newRect.width / aspectRatio;
                }
                cropRect = newRect;
            } else {
                let newRect = { ...dragStartRect };
                switch (draggingHandle) {
                    case 'tl':
                        newRect.left = Math.max(imgRect.left, Math.min(mx, dragStartRect.left + dragStartRect.width - 10));
                        newRect.top = Math.max(imgRect.top, Math.min(my, dragStartRect.top + dragStartRect.height - 10));
                        newRect.width = dragStartRect.left + dragStartRect.width - newRect.left;
                        newRect.height = dragStartRect.top + dragStartRect.height - newRect.top;
                        break;
                    case 'tr':
                        newRect.top = Math.max(imgRect.top, Math.min(my, dragStartRect.top + dragStartRect.height - 10));
                        newRect.width = Math.max(10, mx - dragStartRect.left);
                        newRect.height = dragStartRect.top + dragStartRect.height - newRect.top;
                        break;
                    case 'bl':
                        newRect.left = Math.max(imgRect.left, Math.min(mx, dragStartRect.left + dragStartRect.width - 10));
                        newRect.width = dragStartRect.left + dragStartRect.width - newRect.left;
                        newRect.height = Math.max(10, my - dragStartRect.top);
                        break;
                    case 'br':
                        newRect.width = Math.max(10, mx - dragStartRect.left);
                        newRect.height = Math.max(10, my - dragStartRect.top);
                        break;
                }
                // clamp to image bounds
                newRect.width = Math.min(newRect.width, imgRect.left + imgRect.width - newRect.left);
                newRect.height = Math.min(newRect.height, imgRect.top + imgRect.height - newRect.top);
                cropRect = newRect;
            }
            updateCropSelectionUI();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDrawing) {
            isDrawing = false;
            if (cropRect.width > 5 && cropRect.height > 5) {
                cropActions.style.display = 'flex';
            } else {
                cropSelection.style.display = 'none';
            }
        }
        if (draggingHandle) {
            draggingHandle = null;
            dragStartRect = null;
            if (cropRect.width > 5 && cropRect.height > 5) {
                cropActions.style.display = 'flex';
            }
        }
    });

    function updateCropSelectionUI() {
        cropSelection.style.left = cropRect.left + 'px';
        cropSelection.style.top = cropRect.top + 'px';
        cropSelection.style.width = cropRect.width + 'px';
        cropSelection.style.height = cropRect.height + 'px';
        cropSelection.style.display = 'block';
        // 确定/取消按钮智能定位，避免被容器边缘遮挡
        const containerW = cropContainer.clientWidth;
        const containerH = cropContainer.clientHeight;
        const btnW = 150; // 按钮组预估宽度
        const btnH = 36;  // 按钮组预估高度
        const gap = 8;
        // 水平居中，但不超出容器左右边界
        let btnLeft = cropRect.left + cropRect.width / 2;
        btnLeft = Math.max(btnW / 2, Math.min(btnLeft, containerW - btnW / 2));
        // 默认放在选区下方，放不下则放在选区上方
        let btnTop = cropRect.top + cropRect.height + gap;
        if (btnTop + btnH > containerH - gap) {
            btnTop = cropRect.top - btnH - gap;
        }
        // 上方也放不下则紧贴底部
        if (btnTop < gap) {
            btnTop = containerH - btnH - gap;
        }
        cropActions.style.left = btnLeft + 'px';
        cropActions.style.top = btnTop + 'px';
    }

    // 滚轮缩放图片（以鼠标位置为中心）
    cropContainer.addEventListener('wheel', (e) => {
        if (!splitPreviewImage.src) return;
        e.preventDefault();
        const imgRect = splitPreviewImage.getBoundingClientRect();
        const originX = e.clientX - imgRect.left;
        const originY = e.clientY - imgRect.top;
        splitPreviewImage.style.transformOrigin = `${originX}px ${originY}px`;
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        zoomScale = Math.max(0.2, Math.min(5, zoomScale + delta));
        splitPreviewImage.style.transform = `scale(${zoomScale})`;
        // 缩放后重置选区
        if (cropMode) {
            cropSelection.style.display = 'none';
            cropActions.style.display = 'none';
            cropRect = { left: 0, top: 0, width: 0, height: 0 };
            isDrawing = false;
            draggingHandle = null;
            dragStartRect = null;
        }
    }, { passive: false });

    // 确认裁剪（连续裁剪模式：裁剪后不清除选区，可继续裁剪）
    confirmCropBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cropRect.width < 5 || cropRect.height < 5) {
            // 选区太小，仅清除选区
            cropSelection.style.display = 'none';
            cropActions.style.display = 'none';
            cropRect = { left: 0, top: 0, width: 0, height: 0 };
            return;
        }
        try {
            const imgRect = getImageRect();
            const img = splitPreviewImage;
            const scaleX = img.naturalWidth / imgRect.width;
            const scaleY = img.naturalHeight / imgRect.height;

            const sx = (cropRect.left - imgRect.left) * scaleX;
            const sy = (cropRect.top - imgRect.top) * scaleY;
            const sw = cropRect.width * scaleX;
            const sh = cropRect.height * scaleY;

            const canvas = document.createElement('canvas');
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            const dataUrl = canvas.toDataURL('image/png');

            cropResults.push(dataUrl);
            renderCropResults();
        } catch (err) {
            console.error('裁剪失败:', err);
        }
        // 连续裁剪：不清除模式，仅清除当前选区
        cropSelection.style.display = 'none';
        cropActions.style.display = 'none';
        cropRect = { left: 0, top: 0, width: 0, height: 0 };
    });

    // 取消裁剪（仅清除当前选区，保持裁剪模式）
    cancelCropBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cropSelection.style.display = 'none';
        cropActions.style.display = 'none';
        cropRect = { left: 0, top: 0, width: 0, height: 0 };
    });

    // 全部下载按钮
    splitDownloadAllBtn.addEventListener('click', async () => {
        for (let i = 0; i < cropResults.length; i++) {
            await downloadImage(cropResults[i], `裁剪结果_${i + 1}.png`);
        }
    });

    // 下载（1600）按钮
    splitDownload1600Btn.addEventListener('click', async () => {
        for (let i = 0; i < cropResults.length; i++) {
            await downloadImage(cropResults[i], `裁剪结果_${i + 1}_1600.png`, { width: 1600, height: 1600 });
        }
    });

    // 删除全部裁剪按钮
    splitClearAllBtn.addEventListener('click', () => {
        cropResults = [];
        renderCropResults();
    });

    // 导入到表格按钮
    splitImportBtn.addEventListener('click', async () => {
        if (cropResults.length === 0) return;

        // 生成新的组ID
        groupIdCounter++;
        const groupId = groupIdCounter;

        // 为这个组分配颜色索引
        groupColorIndex.set(groupId, nextColorIndex);
        nextColorIndex = (nextColorIndex + 1) % GROUP_COLORS.length;

        // 初始化组数据
        rowGroups.set(groupId, []);

        const createdRows = [];
        const rowIds = [];

        // 从后往前遍历，使用 addRow(true) 插入顶部，保持正确顺序
        for (let i = cropResults.length - 1; i >= 0; i--) {
            const dataUrl = cropResults[i];

            // 将 data URL 转换为 File 对象
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `裁剪结果_${i + 1}.png`, { type: 'image/png' });

            // 创建新行并插入顶部
            const newRow = addRow(true);
            const rowId = parseInt(newRow.dataset.rowId);

            // 设置组的视觉标识
            newRow.setAttribute('data-group-id', groupId);
            updateRowGroupStyle(newRow, groupId);

            createdRows.unshift(newRow);
            rowIds.unshift(rowId);

            // 将rowId映射到组
            rowToGroup.set(rowId, groupId);

            // 设置商品图片
            const productUploadArea = newRow.querySelector('.product-upload');
            const productPreview = newRow.querySelector('.product-preview');
            const productDeleteBtn = newRow.querySelector('.product-delete-btn');
            const productGalleryBtn = newRow.querySelector('.product-gallery-btn');
            const productFileInput = newRow.querySelector('.product-file-input');

            if (productUploadArea && productPreview) {
                newRow.productImages.push(dataUrl);
                productPreview.src = newRow.productImages[0];
                productUploadArea.classList.add('has-image');
                productDeleteBtn.style.display = 'block';
                productGalleryBtn.style.display = 'inline-block';
                productGalleryBtn.textContent = `展开 (${newRow.productImages.length}张)`;

                // 创建File对象并赋值给input
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                productFileInput.files = dataTransfer.files;
            }
        }

        // 将rowIds按正确顺序添加到组
        rowGroups.set(groupId, rowIds);

        // 初始化组为展开状态
        groupExpandedState.set(groupId, true);

        // 更新组UI，创建展开按钮
        updateGroupUI(groupId);

        // 滚动到第一行
        const firstRow = document.querySelector(`tr[data-row-id="${rowIds[0]}"]`);
        if (firstRow) {
            firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        console.log(`从裁剪结果导入完成：创建了 ${rowIds.length} 行，组ID: ${groupId}`);
    });

    function handleSplitImageUpload(file) {
        if (!file.type.startsWith('image/')) {
            alert('请上传图片文件！');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            splitPreviewImage.src = e.target.result;
            splitPreviewImage.style.transform = '';
            zoomScale = 1;
            splitUploadArea.style.display = 'none';
            splitPreviewArea.style.display = 'flex';
            splitCropToolbar.style.display = 'flex';
            splitImageDimensions.style.display = 'inline';
            splitImageDimensions.textContent = '加载中...';
            splitPreviewImage.onload = () => {
                splitImageDimensions.textContent = `${splitPreviewImage.naturalWidth} × ${splitPreviewImage.naturalHeight}`;
            };
            resetCropState();
            renderCropResults();
        };
        reader.readAsDataURL(file);
    }

    // 对外暴露：从图片模态框的裁剪按钮编程式加载图片到拆分模块
    window.loadImageToSplitModule = async function(imageUrl) {
        cropResults = [];
        zoomScale = 1;
        resetCropState();

        splitModal.style.display = 'flex';
        splitUploadArea.style.display = 'none';
        splitPreviewArea.style.display = 'flex';
        splitCropToolbar.style.display = 'flex';
        splitImageDimensions.style.display = 'inline';
        splitImageDimensions.textContent = '加载中...';
        splitPreviewImage.style.transform = '';

        let displayUrl = imageUrl;
        if (!imageUrl.startsWith('data:')) {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                displayUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn('无法获取图片转换为 data URL，使用原始 URL:', e);
                displayUrl = imageUrl;
            }
        }

        splitPreviewImage.src = displayUrl;
        splitPreviewImage.onload = () => {
            splitImageDimensions.textContent =
                `${splitPreviewImage.naturalWidth} × ${splitPreviewImage.naturalHeight}`;
        };
        splitPreviewImage.onerror = () => {
            splitImageDimensions.textContent = '加载失败';
        };

        renderCropResults();
    };
}

// ==================== 模块切换功能 ====================
function initModuleSwitcher() {
    const smartTableBtn = document.getElementById('smartTableBtn');
    const visualAgentBtn = document.getElementById('visualAgentBtn');
    const smartTableModule = document.getElementById('smartTableModule');
    const visualAgentModule = document.getElementById('visualAgentModule');

    // 智能表格按钮点击事件
    smartTableBtn.addEventListener('click', function() {
        // 切换按钮激活状态
        smartTableBtn.classList.add('active');
        visualAgentBtn.classList.remove('active');

        // 切换模块显示
        smartTableModule.classList.add('active');
        visualAgentModule.classList.remove('active');
    });

    // Amazon Visual Agent按钮点击事件
    visualAgentBtn.addEventListener('click', function() {
        // 切换按钮激活状态
        visualAgentBtn.classList.add('active');
        smartTableBtn.classList.remove('active');

        // 切换模块显示
        visualAgentModule.classList.add('active');
        smartTableModule.classList.remove('active');
    });
}

// ==================== Amazon Visual Agent 模块 ====================
// 使用独立的命名空间，确保与智能表格模块完全隔离
const VisualAgentModule = {
    init: function() {
        console.log('Amazon Visual Agent 模块初始化（预留）');
    }
};


