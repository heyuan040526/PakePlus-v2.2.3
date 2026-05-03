// 全局变量
let rowCount = 0;
let selectedRows = new Set();
let lastClickedRowId = null;
// 跟踪每一行的提示词生成状态
let promptGeneratingRows = new Set();
// 跟踪提示词模式选择
let currentPromptModeRow = null;
let currentPromptModeType = null;

const sizePresets = [
    '21:9',
    '16:9',
    '4:3',
    '3:2',
    '1:1',
    '2:3',
    '3:4',
    '9:16',
    '9:21',
    '自定义'
];

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
let aiSettings = {
    // 图像识别API
    imageApiBaseUrl: 'https://ai.comfly.chat',
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
    aplusTemplate: `这是一个{product_name}，根据：

{extract_result}

制作一套亚马逊超级A+图片提示词（共8张），图片比例为1464:600。

【整体风格要求】
- 画面风格：简洁专业、高端大气，符合亚马逊电商平台调性
- 背景：纯白色或浅色渐变背景，突出产品主体
- 光线：柔和自然光，避免强烈阴影
- 色调：明亮清晰，色彩真实还原
- 景深控制：背景适度虚化即可，避免过度模糊产生波浪效果，保持画面自然清晰

【字体风格要求】
- 字体：现代无衬线字体（Arial, Helvetica, Roboto）
- 主标题颜色：深色系 #2C3E50 或品牌色
- 副标题颜色：中性灰 #7F8C8D
- 强调文字颜色：蓝色 #3498DB 或绿色 #27AE60
- 排版：清晰层次，左对齐或居中，行距适中
- 语言：全部使用英文

【图片类型】
1. 主图：纯白背景，产品正面展示
2. 生活方式图×2：真实使用场景，**必须包含英文文字说明**，描述使用场景或产品特点（如 "Perfect for Daily Use", "Ideal for Home & Office"）
3. 卖点图：突出核心卖点，配图标和文字
4. 场景图×2：不同使用环境，**必须包含英文文字标注**，说明场景特点或产品优势（如 "Versatile Design", "Easy to Clean"）
5. 对比图：展示产品优势
6. 材质工艺图：特写展现细节

**重要提示**：生活方式图和场景图必须在画面中清晰显示英文文字，文字内容要简洁有力，突出产品使用场景或核心优势。

请为每张图片生成详细的英文提示词。`,

    // 图片生成API
    imageGenApiBaseUrl: 'https://ai.comfly.chat',
    imageGenApiKey: '',
    imageGenModelName: 'gpt-image-2'
};

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

    // 创建默认的3行
    for (let i = 0; i < 3; i++) {
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

    // 提示词模式选择弹窗事件
    document.getElementById('closePromptModeBtn').addEventListener('click', closePromptModeModal);
    document.getElementById('promptModeModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closePromptModeModal();
        }
    });

    // 模式选择按钮事件
    document.querySelectorAll('.mode-select-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mode = this.dataset.mode;
            handleModeSelection(mode);
        });
    });

    // 自由模式输入弹窗事件
    document.getElementById('closeFreePromptBtn').addEventListener('click', closeFreePromptModal);
    document.getElementById('cancelFreePromptBtn').addEventListener('click', closeFreePromptModal);
    document.getElementById('saveFreePromptBtn').addEventListener('click', saveFreePrompt);
    document.getElementById('freePromptModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeFreePromptModal();
        }
    });

    // 保存/加载按钮事件
    document.getElementById('saveDataBtn').addEventListener('click', saveToJSON);
    document.getElementById('loadDataBtn').addEventListener('click', () => {
        document.getElementById('loadFileInput').click();
    });
    document.getElementById('loadFileInput').addEventListener('change', loadFromJSON);
});

// 监听J键打开设置
document.addEventListener('keydown', function(e) {
    if (e.key === 'j' || e.key === 'J') {
        // 检查是否在输入框中
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        e.preventDefault();
        openSettings();
    }
});

// 提取结果编辑弹窗相关
let currentEditingRowId = null;

// 添加新行
function addRow() {
    rowCount++;
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    row.dataset.rowId = rowCount;

    row.innerHTML = `
        <td class="row-number-cell" data-row="${rowCount}">
            <span class="row-number">${rowCount}</span>
            <button class="delete-btn-hidden" data-row="${rowCount}">删除</button>
        </td>
        <td>
            <div class="product-upload-wrapper">
                <div class="upload-area product-upload" data-row="${rowCount}">
                    <input type="file" accept="image/*" class="product-file-input" data-row="${rowCount}">
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
                <button class="product-text-delete-btn" data-row="${rowCount}" style="display:none;">删除</button>
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
            <div class="reference-upload-container" data-row="${rowCount}">
                <div class="upload-area reference-upload" data-row="${rowCount}">
                    <input type="file" accept="image/*" multiple class="reference-file-input" data-row="${rowCount}">
                    <div class="upload-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>上传图片</span>
                    </div>
                    <img class="reference-preview" alt="预览">
                    <button class="delete-image-btn reference-delete-btn" data-row="${rowCount}" style="display:none;">×</button>
                </div>
                <button class="reference-gallery-btn" data-row="${rowCount}" style="display:none;">展开</button>
            </div>
        </td>
        <td>
            <div class="prompt-container" data-row="${rowCount}">
                <button class="prompt-mode-toggle" data-row="${rowCount}" data-mode="amazon" title="点击切换模式">
                    <span class="mode-indicator">亚马逊</span>
                </button>
                <div class="prompt-buttons-container" data-row="${rowCount}">
                    <button class="main-image-btn" data-row="${rowCount}" disabled>主图</button>
                    <button class="aplus-btn" data-row="${rowCount}" disabled>A+</button>
                </div>
                <div class="free-input-container" data-row="${rowCount}" style="display: none;">
                    <textarea class="free-prompt-input" data-row="${rowCount}" placeholder="输入提示词..."></textarea>
                </div>
                <div class="prompt-result-container" data-row="${rowCount}"></div>
            </div>
        </td>
        <td>
            <select class="size-select" data-row="${rowCount}">
                ${sizePresets.map(size => `<option value="${size}">${size}</option>`).join('')}
            </select>
            <input type="text" class="size-custom" placeholder="自定义尺寸" style="display:none; margin-top:5px;" data-row="${rowCount}">
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
            <button class="generate-btn" data-row="${rowCount}">生成</button>
        </td>
    `;

    tbody.appendChild(row);

    // 绑定事件
    bindRowEvents(row);

    // 自动滚动到新行
    setTimeout(() => {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

// 绑定行事件
function bindRowEvents(row) {
    const rowId = row.dataset.rowId;

    // 商品图片上传（B列）
    const productUploadArea = row.querySelector('.product-upload');
    const productFileInput = row.querySelector('.product-file-input');
    const productPreview = row.querySelector('.product-preview');
    const productDeleteBtn = row.querySelector('.product-delete-btn');
    const productTextDeleteBtn = row.querySelector('.product-text-delete-btn');

    productUploadArea.addEventListener('click', function() {
        // 如果已有图片，则放大查看；否则打开文件选择
        if (productUploadArea.classList.contains('has-image') && productPreview.src) {
            showImageModal(productPreview.src);
        } else {
            productFileInput.click();
        }
    });

    productFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                productPreview.src = e.target.result;
                productUploadArea.classList.add('has-image');
                productDeleteBtn.style.display = 'block';
                productTextDeleteBtn.style.display = 'inline-block';
            };
            reader.readAsDataURL(file);
        }
    });

    productDeleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        productPreview.src = '';
        productUploadArea.classList.remove('has-image');
        productDeleteBtn.style.display = 'none';
        productTextDeleteBtn.style.display = 'none';
        productFileInput.value = '';
    });

    productTextDeleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        productPreview.src = '';
        productUploadArea.classList.remove('has-image');
        productDeleteBtn.style.display = 'none';
        productTextDeleteBtn.style.display = 'none';
        productFileInput.value = '';
    });

    // 参考图片上传（E列）- 支持多图片
    const referenceUploadArea = row.querySelector('.reference-upload');
    const referenceFileInput = row.querySelector('.reference-file-input');
    const referencePreview = row.querySelector('.reference-preview');
    const referenceDeleteBtn = row.querySelector('.reference-delete-btn');
    const galleryBtn = row.querySelector('.reference-gallery-btn');

    // 存储该行的所有参考图片
    if (!row.referenceImages) {
        row.referenceImages = [];
    }

    referenceUploadArea.addEventListener('click', () => referenceFileInput.click());

    referenceFileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        row.referenceImages.push(e.target.result);
                        // 显示第一张图片
                        referencePreview.src = row.referenceImages[0];
                        referenceUploadArea.classList.add('has-image');
                        // 显示删除按钮和画廊按钮
                        referenceDeleteBtn.style.display = 'block';
                        galleryBtn.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });

    referenceDeleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        referencePreview.src = '';
        referenceUploadArea.classList.remove('has-image');
        referenceDeleteBtn.style.display = 'none';
        referenceFileInput.value = '';
        row.referenceImages = [];
        galleryBtn.style.display = 'none';
    });

    // 画廊按钮点击事件
    galleryBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleReferenceGallery(row);
    });

    // 历史图片（I列）- 支持多图片
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

    sizeSelect.addEventListener('change', function() {
        if (this.value === '自定义') {
            sizeCustom.style.display = 'block';
        } else {
            sizeCustom.style.display = 'none';
        }
    });

    // 主图和A+按钮
    const mainImageBtn = row.querySelector('.main-image-btn');
    const aplusBtn = row.querySelector('.aplus-btn');
    const extractDisplay = row.querySelector('.extract-display');

    // 监听提取结果变化，控制按钮状态
    const observer = new MutationObserver(function() {
        const extractText = extractDisplay.textContent.trim();
        const currentRowId = parseInt(row.dataset.rowId);

        // 只有当提取完成且不是加载状态，并且当前行没有正在生成提示词时才启用按钮
        if (extractText &&
            extractText !== '未提取' &&
            !extractText.includes('正在分析') &&
            !extractText.includes('提取中') &&
            !extractText.includes('分析中') &&
            !promptGeneratingRows.has(currentRowId)) {
            mainImageBtn.disabled = false;
            aplusBtn.disabled = false;
        } else {
            mainImageBtn.disabled = true;
            aplusBtn.disabled = true;
        }
    });

    observer.observe(extractDisplay, {
        childList: true,
        characterData: true,
        subtree: true
    });

    // 主图按钮点击事件
    mainImageBtn.addEventListener('click', function() {
        const modeToggle = row.querySelector('.prompt-mode-toggle');
        if (!modeToggle) return;
        const currentMode = modeToggle.dataset.mode;

        if (currentMode === 'amazon') {
            generatePrompts(rowId, 'main');
        } else {
            showFreePromptModal(row, 'main');
        }
    });

    // A+按钮点击事件
    aplusBtn.addEventListener('click', function() {
        const modeToggle = row.querySelector('.prompt-mode-toggle');
        if (!modeToggle) return;
        const currentMode = modeToggle.dataset.mode;

        if (currentMode === 'amazon') {
            generatePrompts(rowId, 'aplus');
        } else {
            showFreePromptModal(row, 'aplus');
        }
    });

    // 模式切换按钮点击事件
    const modeToggle = row.querySelector('.prompt-mode-toggle');
    modeToggle.addEventListener('click', function() {
        const currentMode = this.dataset.mode;
        const modeIndicator = this.querySelector('.mode-indicator');
        const buttonsContainer = row.querySelector('.prompt-buttons-container');
        const freeInputContainer = row.querySelector('.free-input-container');

        console.log('=== 模式切换调试 ===');
        console.log('当前模式:', currentMode);
        console.log('buttonsContainer:', buttonsContainer);
        console.log('freeInputContainer:', freeInputContainer);

        if (currentMode === 'amazon') {
            this.dataset.mode = 'free';
            modeIndicator.textContent = '自由';
            this.classList.add('free-mode');
            if (buttonsContainer) buttonsContainer.style.display = 'none';
            if (freeInputContainer) freeInputContainer.style.display = 'flex';
            console.log('切换到自由模式');
        } else {
            this.dataset.mode = 'amazon';
            modeIndicator.textContent = '亚马逊';
            this.classList.remove('free-mode');
            if (buttonsContainer) buttonsContainer.style.display = 'flex';
            if (freeInputContainer) freeInputContainer.style.display = 'none';
            console.log('切换到亚马逊模式');
        }
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
    const rowNumberCell = row.querySelector('.row-number-cell');
    const rowNumberSpan = row.querySelector('.row-number');
    const deleteBtn = row.querySelector('.delete-btn-hidden');

    rowNumberCell.addEventListener('click', function(e) {
        e.stopPropagation();
        const rowId = parseInt(row.dataset.rowId);

        if (e.shiftKey && lastClickedRowId !== null) {
            // Shift+点击：范围选择
            const start = Math.min(lastClickedRowId, rowId);
            const end = Math.max(lastClickedRowId, rowId);

            for (let i = start; i <= end; i++) {
                selectedRows.add(i);
            }
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+点击：多选
            if (selectedRows.has(rowId)) {
                selectedRows.delete(rowId);
            } else {
                selectedRows.add(rowId);
            }
        } else {
            // 普通点击：单选
            selectedRows.clear();
            selectedRows.add(rowId);
        }

        lastClickedRowId = rowId;
        updateSelectionUI();
    });

    // 序号单元格双击事件 - 复制到下方
    rowNumberCell.addEventListener('dblclick', function(e) {
        e.stopPropagation();
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

    // 输入框自动保存（已禁用）
    // const inputs = row.querySelectorAll('input[type="text"], textarea, select');
    // inputs.forEach(input => {
    //     input.addEventListener('input', saveData);
    //     input.addEventListener('change', saveData);
    // });
}

// 全局点击事件，隐藏所有删除按钮
document.addEventListener('click', function(e) {
    if (!e.target.closest('.row-number-cell')) {
        // 点击其他地方时不清除选择
    }
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
    if (selectedRows.size > 0) {
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
        const rows = document.querySelectorAll('#tableBody tr');
        rows.forEach(row => {
            const rowId = parseInt(row.dataset.rowId);
            if (selectedRows.has(rowId)) {
                row.remove();
            }
        });

        selectedRows.clear();
        lastClickedRowId = null;
        updateRowNumbers();
        updateSelectionUI();
    }
}

// 取消选择
function cancelSelection() {
    selectedRows.clear();
    lastClickedRowId = null;
    updateSelectionUI();
}

// 生成图片
async function generateImage(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    const generateBtn = row.querySelector('.generate-btn');
    const resultDisplay = row.querySelector('.image-display');
    const historyThumbnails = row.querySelector('.history-thumbnails');

    // 验证API设置
    if (!aiSettings.imageGenApiBaseUrl || !aiSettings.imageGenApiKey) {
        alert('请先按J键配置图片生成API设置！');
        return;
    }

    // 获取尺寸
    const sizeSelect = row.querySelector('.size-select');
    const sizeCustom = row.querySelector('.size-custom');
    const aspectRatio = sizeSelect.value === '自定义' ? sizeCustom.value : sizeSelect.value;

    console.log('=== 尺寸调试信息 ===');
    console.log('sizeSelect.value:', sizeSelect.value);
    console.log('sizeCustom.value:', sizeCustom.value);
    console.log('最终使用的 aspectRatio:', aspectRatio);

    if (!aspectRatio) {
        alert('请选择图片尺寸！');
        return;
    }

    // 检查当前模式
    const modeToggle = row.querySelector('.prompt-mode-toggle');
    console.log('=== 生成图片调试 ===');
    console.log('row:', row);
    console.log('rowId:', rowId);
    console.log('modeToggle:', modeToggle);

    if (!modeToggle) {
        console.error('找不到 .prompt-mode-toggle 元素');
        console.log('row.innerHTML:', row.innerHTML);
        alert('无法获取模式信息！请刷新页面重试。');
        return;
    }
    const currentMode = modeToggle.dataset.mode;

    let selectedPrompts = [];
    let type = 'free'; // 默认类型

    if (currentMode === 'free') {
        // 自由模式：从文本框获取提示词
        const freeInput = row.querySelector('.free-prompt-input');
        const freeText = freeInput.value.trim();

        if (!freeText) {
            alert('请输入提示词内容！');
            return;
        }

        selectedPrompts.push({
            index: 0,
            content: freeText
        });
        type = 'free';
    } else {
        // 亚马逊模式：从生成的提示词中获取
        const promptBtn = row.querySelector('.prompt-expand-btn');
        if (!promptBtn || !promptBtn.promptsData) {
            alert('请先生成提示词！');
            return;
        }

        const prompts = promptBtn.promptsData;
        type = promptBtn.dataset.type;

        // 从保存的状态中获取选中的提示词
        if (!row.promptCheckStates || !row.promptCheckStates[type]) {
            alert('请先生成提示词！');
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

        if (selectedPrompts.length === 0) {
            alert('请至少选择一个提示词！');
            return;
        }
    }

    // 获取参考图片（优先使用商品图，其次使用参考图）
    const productPreview = row.querySelector('.product-preview');
    const productImage = productPreview.src;
    let referenceImageBase64 = null;

    if (productImage && productImage !== window.location.href && !productImage.startsWith('http')) {
        // 使用商品图作为参考图
        referenceImageBase64 = productImage;
    } else if (row.referenceImages && row.referenceImages.length > 0) {
        // 使用第一张参考图
        referenceImageBase64 = row.referenceImages[0];
    }

    // 显示加载状态
    generateBtn.classList.add('loading');
    generateBtn.disabled = true;

    try {
        // 遍历每个选中的提示词
        for (let i = 0; i < selectedPrompts.length; i++) {
            const promptData = selectedPrompts[i];
            const promptText = promptData.content;
            const promptIndex = promptData.index;

            // 在按钮上更新进度状态
            generateBtn.textContent = `生成中... (${i + 1}/${selectedPrompts.length})`;

            // 构建请求体
            const requestBody = {
                model: aiSettings.imageGenModelName,
                prompt: promptText,
                aspect_ratio: aspectRatio,
                size: aspectRatio  // 同时添加 size 参数以兼容不同API
            };

            console.log('=== API请求体 ===');
            console.log('请求体:', JSON.stringify(requestBody, null, 2));

            // 如果有参考图，添加到请求中
            if (referenceImageBase64) {
                requestBody.image = [referenceImageBase64];
            }

            // 调用API
            const response = await fetch(`${aiSettings.imageGenApiBaseUrl}/v1/images/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiSettings.imageGenApiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // 提取生成的图片URL
            if (data.data && data.data.length > 0 && data.data[0].url) {
                const imageUrl = data.data[0].url;

                // 显示新生成的图片在结果图片模块
                resultDisplay.classList.remove('empty');
                resultDisplay.innerHTML = `<img src="${imageUrl}" alt="生成结果">`;

                // 同时将图片添加到历史记录，并关联提示词
                addToHistory(row, imageUrl, type, promptIndex);

            } else {
                throw new Error('API返回数据格式错误');
            }

            // 添加延迟，避免请求过快
            if (i < selectedPrompts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // 更新提示词状态显示（仅在亚马逊模式下）
        if (currentMode !== 'free') {
            updatePromptStatus(row, type);
        }

        alert(`成功生成 ${selectedPrompts.length} 张图片！`);

    } catch (error) {
        console.error('图片生成失败:', error);
        alert(`生成失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        generateBtn.classList.remove('loading');
        generateBtn.disabled = false;
        generateBtn.textContent = '生成';
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
        promptIndex: promptIndex
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
            showImageModal(imgUrl, row.historyImages, index);
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
}

// 显示图片模态框
function showImageModal(imageUrl, allImages = null, currentIndex = 0) {
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

    if (images.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '◀';
        prevBtn.style.cssText = `
            position: fixed;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.9);
            border: none;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            z-index: 1001;
            transition: all 0.2s;
        `;
        prevBtn.addEventListener('mouseover', () => {
            prevBtn.style.background = 'rgba(255,255,255,1)';
            prevBtn.style.transform = 'translateY(-50%) scale(1.1)';
        });
        prevBtn.addEventListener('mouseout', () => {
            prevBtn.style.background = 'rgba(255,255,255,0.9)';
            prevBtn.style.transform = 'translateY(-50%)';
        });
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx - 1 + images.length) % images.length;
            img.src = images[currentIdx];
            counter.textContent = `${currentIdx + 1}/${images.length}`;
        });

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '▶';
        nextBtn.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.9);
            border: none;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            z-index: 1001;
            transition: all 0.2s;
        `;
        nextBtn.addEventListener('mouseover', () => {
            nextBtn.style.background = 'rgba(255,255,255,1)';
            nextBtn.style.transform = 'translateY(-50%) scale(1.1)';
        });
        nextBtn.addEventListener('mouseout', () => {
            nextBtn.style.background = 'rgba(255,255,255,0.9)';
            nextBtn.style.transform = 'translateY(-50%)';
        });
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIdx = (currentIdx + 1) % images.length;
            img.src = images[currentIdx];
            counter.textContent = `${currentIdx + 1}/${images.length}`;
        });

        const counter = document.createElement('div');
        counter.textContent = `${currentIdx + 1}/${images.length}`;
        counter.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 16px;
            font-weight: 600;
            z-index: 1001;
        `;

        modal.appendChild(prevBtn);
        modal.appendChild(nextBtn);
        modal.appendChild(counter);

        const keyHandler = (e) => {
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
    `;

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
        menu.remove();
    });

    menu.appendChild(copyBtn);
    document.body.appendChild(menu);

    // 点击其他地方关闭菜单
    setTimeout(() => {
        const closeHandler = function(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 100);
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
                    <input type="file" accept="image/*" class="product-file-input" data-row="${rowCount}">
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
                <button class="product-text-delete-btn" data-row="${rowCount}" style="display:none;">删除</button>
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
            <div class="reference-upload-container" data-row="${rowCount}">
                <div class="upload-area reference-upload" data-row="${rowCount}">
                    <input type="file" accept="image/*" multiple class="reference-file-input" data-row="${rowCount}">
                    <div class="upload-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>上传图片</span>
                    </div>
                    <img class="reference-preview" alt="预览">
                    <button class="delete-image-btn reference-delete-btn" data-row="${rowCount}" style="display:none;">×</button>
                </div>
                <button class="reference-gallery-btn" data-row="${rowCount}" style="display:none;">展开</button>
            </div>
        </td>
        <td>
            <div class="prompt-container" data-row="${rowCount}">
                <button class="prompt-mode-toggle" data-row="${rowCount}" data-mode="amazon" title="点击切换模式">
                    <span class="mode-indicator">亚马逊</span>
                </button>
                <div class="prompt-buttons-container" data-row="${rowCount}">
                    <button class="main-image-btn" data-row="${rowCount}" disabled>主图</button>
                    <button class="aplus-btn" data-row="${rowCount}" disabled>A+</button>
                </div>
                <div class="free-input-container" data-row="${rowCount}" style="display: none;">
                    <textarea class="free-prompt-input" data-row="${rowCount}" placeholder="输入提示词..."></textarea>
                </div>
                <div class="prompt-result-container" data-row="${rowCount}"></div>
            </div>
        </td>
        <td>
            <select class="size-select" data-row="${rowCount}">
                ${sizePresets.map(size => `<option value="${size}">${size}</option>`).join('')}
            </select>
            <input type="text" class="size-custom" placeholder="自定义尺寸" style="display:none; margin-top:5px;" data-row="${rowCount}">
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
            <button class="generate-btn" data-row="${rowCount}">生成</button>
        </td>
    `;

    // 插入到源行的下方
    sourceRow.parentNode.insertBefore(newRow, sourceRow.nextSibling);

    // 绑定事件
    bindRowEvents(newRow);

    // 复制 B、C、D、E 列的内容

    // B列：商品图
    const sourceProductPreview = sourceRow.querySelector('.product-preview');
    if (sourceProductPreview && sourceProductPreview.src && sourceProductPreview.src !== window.location.href) {
        const newProductPreview = newRow.querySelector('.product-preview');
        const newProductUploadArea = newRow.querySelector('.product-upload');
        const newProductDeleteBtn = newRow.querySelector('.product-delete-btn');
        const newProductTextDeleteBtn = newRow.querySelector('.product-text-delete-btn');

        newProductPreview.src = sourceProductPreview.src;
        newProductUploadArea.classList.add('has-image');
        newProductDeleteBtn.style.display = 'block';
        newProductTextDeleteBtn.style.display = 'inline-block';
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
    }

    // E列：参考图
    if (sourceRow.referenceImages && sourceRow.referenceImages.length > 0) {
        newRow.referenceImages = [...sourceRow.referenceImages];

        const newReferencePreview = newRow.querySelector('.reference-preview');
        const newReferenceUploadArea = newRow.querySelector('.reference-upload');
        const newReferenceDeleteBtn = newRow.querySelector('.reference-delete-btn');
        const newGalleryBtn = newRow.querySelector('.reference-gallery-btn');

        newReferencePreview.src = sourceRow.referenceImages[0];
        newReferenceUploadArea.classList.add('has-image');
        newReferenceDeleteBtn.style.display = 'block';
        newGalleryBtn.style.display = 'block';
    }

    // 重置其他列为默认状态
    // F列：提示词模式重置为亚马逊模式
    const newPromptModeToggle = newRow.querySelector('.prompt-mode-toggle');
    if (newPromptModeToggle) {
        newPromptModeToggle.dataset.mode = 'amazon';
        newPromptModeToggle.querySelector('.mode-indicator').textContent = '亚马逊';
    }
    const newMainImageBtn = newRow.querySelector('.main-image-btn');
    const newAplusBtn = newRow.querySelector('.aplus-btn');
    if (newMainImageBtn) newMainImageBtn.disabled = true;
    if (newAplusBtn) newAplusBtn.disabled = true;
    const newFreeInputContainer = newRow.querySelector('.free-input-container');
    if (newFreeInputContainer) newFreeInputContainer.style.display = 'none';
    const newPromptButtonsContainer = newRow.querySelector('.prompt-buttons-container');
    if (newPromptButtonsContainer) newPromptButtonsContainer.style.display = 'block';

    // G列：尺寸重置为第一个选项（默认值）
    const newSizeSelect = newRow.querySelector('.size-select');
    if (newSizeSelect) {
        newSizeSelect.selectedIndex = 0;
    }
    const newSizeCustom = newRow.querySelector('.size-custom');
    if (newSizeCustom) {
        newSizeCustom.style.display = 'none';
        newSizeCustom.value = '';
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

// 保存数据到 localStorage（已禁用）
function saveData() {
    // 不再保存数据，每次刷新恢复默认状态
}

// 加载数据（已删除，不再需要）

// 页面卸载前保存数据（已禁用）
// window.addEventListener('beforeunload', saveData);

// 切换参考图片画廊展开/收起
function toggleReferenceGallery(row) {
    const images = row.referenceImages || [];
    if (images.length === 0) return;

    const rowId = row.dataset.rowId;
    const existingGalleryRow = document.querySelector(`tr.gallery-row[data-parent-row="${rowId}"]`);

    if (existingGalleryRow) {
        // 如果已经展开，则收起
        existingGalleryRow.remove();
        row.querySelector('.reference-gallery-btn').classList.remove('expanded');
    } else {
        // 展开画廊
        const galleryRow = document.createElement('tr');
        galleryRow.className = 'gallery-row';
        galleryRow.dataset.parentRow = rowId;

        const galleryCell = document.createElement('td');
        galleryCell.colSpan = 10;
        galleryCell.className = 'gallery-cell';

        const galleryContainer = document.createElement('div');
        galleryContainer.className = 'gallery-container';

        const galleryTitle = document.createElement('div');
        galleryTitle.className = 'gallery-title';
        galleryTitle.textContent = `参考图片 (${images.length}张)`;

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
                row.referenceImages.splice(index, 1);
                if (row.referenceImages.length > 0) {
                    row.querySelector('.reference-preview').src = row.referenceImages[0];
                    toggleReferenceGallery(row);
                    setTimeout(() => toggleReferenceGallery(row), 0);
                } else {
                    row.querySelector('.reference-upload').classList.remove('has-image');
                    row.querySelector('.reference-delete-btn').style.display = 'none';
                    row.querySelector('.reference-gallery-btn').style.display = 'none';
                    galleryRow.remove();

                }
            });

            imgWrapper.appendChild(img);
            imgWrapper.appendChild(deleteBtn);
            imagesGrid.appendChild(imgWrapper);
        });

        // 添加更多图片按钮
        const addMoreBtn = document.createElement('div');
        addMoreBtn.className = 'gallery-add-more';
        addMoreBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>添加更多</span>
        `;
        addMoreBtn.addEventListener('click', () => {
            row.querySelector('.reference-file-input').click();
        });
        imagesGrid.appendChild(addMoreBtn);

        galleryContainer.appendChild(galleryTitle);
        galleryContainer.appendChild(imagesGrid);
        galleryCell.appendChild(galleryContainer);
        galleryRow.appendChild(galleryCell);

        row.parentNode.insertBefore(galleryRow, row.nextSibling);
        row.querySelector('.reference-gallery-btn').classList.add('expanded');

        // 添加全局点击事件，点击外部区域关闭展开行
        const galleryBtn = row.querySelector('.reference-gallery-btn');
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
        galleryCell.colSpan = 10;
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

        row.parentNode.insertBefore(galleryRow, row.nextSibling);
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
    let targetSize = null;

    // 根据预设尺寸映射到目标尺寸
    switch(sizeSelect) {
        case '1:1':
            targetSize = { width: 1600, height: 1600 };
            break;
        case '21:9':
            targetSize = { width: 1464, height: 600 };
            break;
        case '3:2':
            targetSize = { width: 970, height: 600 };
            break;
        default:
            targetSize = null; // 保持原尺寸
    }

    // 如果只有一张图片，直接下载
    if (images.length === 1) {
        downloadBtn.textContent = '1/1';
        await downloadImage(images[0], `历史图片_行${rowNumber}_1.png`, targetSize);

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

        await downloadImage(images[i], `历史图片_行${rowNumber}_${current}.png`, targetSize);

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

// 缩放图片到指定尺寸
function resizeImageToSize(url, targetSize) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        // 只对非base64图片设置跨域
        if (!url.startsWith('data:')) {
            img.crossOrigin = 'anonymous';
        }

        img.onload = function() {
            // 创建canvas
            const canvas = document.createElement('canvas');
            canvas.width = targetSize.width;
            canvas.height = targetSize.height;

            const ctx = canvas.getContext('2d');
            // 使用高质量缩放
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // 绘制缩放后的图片
            ctx.drawImage(img, 0, 0, targetSize.width, targetSize.height);

            // 转换为blob
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas转换失败'));
                }
            }, 'image/png', 1.0);
        };

        img.onerror = function(error) {
            console.error('图片加载失败:', error);
            reject(new Error('图片加载失败'));
        };

        img.src = url;
    });
}

// 下载单张图片
function downloadImage(url, filename, targetSize = null) {
    return new Promise(async (resolve) => {
        try {
            // 如果需要缩放
            if (targetSize) {
                const blob = await resizeImageToSize(url, targetSize);
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                resolve();
                return;
            }

            // 不需要缩放，按原逻辑处理
            if (url.startsWith('data:')) {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                resolve();
            } else {
                // 对于外部URL，使用fetch转换为blob
                fetch(url)
                    .then(response => response.blob())
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    })
                    .catch(error => {
                        console.error('下载失败:', error);
                        // 如果fetch失败，尝试直接下载
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        resolve();
                    });
            }
        } catch (error) {
            console.error('图片处理失败:', error);
            // 降级为直接下载
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            resolve();
        }
    });
}

// 显示参考图片画廊
function showReferenceGallery(row) {
    const images = row.referenceImages || [];
    if (images.length === 0) return;

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 2000;';

    const galleryContainer = document.createElement('div');
    galleryContainer.style.cssText = 'background: white; border-radius: 8px; padding: 20px; max-width: 90%; max-height: 90%; overflow-y: auto; position: relative;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border: none; background: #e74c3c; color: white; font-size: 24px; border-radius: 50%; cursor: pointer;';
    closeBtn.addEventListener('click', () => modal.remove());

    const title = document.createElement('h3');
    title.textContent = '参考图片 (' + images.length + '张)';
    title.style.marginBottom = '20px';

    const imagesGrid = document.createElement('div');
    imagesGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;';

    images.forEach((imgSrc, index) => {
        const imgWrapper = document.createElement('div');
        imgWrapper.style.cssText = 'position: relative; border: 2px solid #ddd; border-radius: 8px; overflow: hidden;';

        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.cssText = 'width: 100%; height: 150px; object-fit: cover; cursor: pointer;';
        img.addEventListener('click', () => showImageModal(imgSrc));

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border: none; background: rgba(231, 76, 60, 0.9); color: white; font-size: 18px; border-radius: 50%; cursor: pointer;';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            row.referenceImages.splice(index, 1);
            modal.remove();
            if (row.referenceImages.length > 0) {
                row.querySelector('.reference-preview').src = row.referenceImages[0];
            } else {
                row.querySelector('.reference-upload').classList.remove('has-image');
                row.querySelector('.reference-gallery-btn').style.display = 'none';
            }
        });

        imgWrapper.appendChild(img);
        imgWrapper.appendChild(deleteBtn);
        imagesGrid.appendChild(imgWrapper);
    });

    galleryContainer.appendChild(closeBtn);
    galleryContainer.appendChild(title);
    galleryContainer.appendChild(imagesGrid);
    modal.appendChild(galleryContainer);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
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
        aiSettings = JSON.parse(saved);
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

    // 填充到表单 - 主图模板
    if (document.getElementById('mainImageTemplate')) {
        document.getElementById('mainImageTemplate').value = aiSettings.mainImageTemplate || '';
    }

    // 填充到表单 - A+模板
    if (document.getElementById('aplusTemplate')) {
        document.getElementById('aplusTemplate').value = aiSettings.aplusTemplate || '';
    }

    // 填充到表单 - 图片生成API
    document.getElementById('imageGenApiBaseUrl').value = aiSettings.imageGenApiBaseUrl || 'https://ai.comfly.chat';
    document.getElementById('imageGenApiKey').value = aiSettings.imageGenApiKey || '';
    document.getElementById('imageGenModelName').value = aiSettings.imageGenModelName || 'gpt-image-2';
}

// 保存AI设置
function saveSettings() {
    aiSettings = {
        // 图像识别API - 只保存API Key和提示词，其他使用默认值
        imageApiBaseUrl: 'https://ai.comfly.chat',
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
        imageGenApiBaseUrl: document.getElementById('imageGenApiBaseUrl').value.trim() || 'https://ai.comfly.chat',
        imageGenApiKey: document.getElementById('imageGenApiKey').value.trim(),
        imageGenModelName: document.getElementById('imageGenModelName').value.trim() || 'gpt-image-2'
    };

    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
    alert('设置已保存！');
    closeSettings();
}

// 清除AI设置
function clearSettings() {
    if (!confirm('确定要清除所有API和提示词设置吗？')) {
        return;
    }

    // 清除localStorage
    localStorage.removeItem(AI_SETTINGS_KEY);

    // 重置为默认值
    aiSettings = {
        imageApiBaseUrl: 'https://ai.comfly.chat',
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
1、...`
    };

    // 重新加载表单
    loadAISettings();

    alert('设置已清除！');
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

        // 创建canvas转换
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
        };

        img.onerror = function() {
            reject('图片加载失败');
        };

        img.src = imgElement.src;
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
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('图像识别失败:', error);
        extractDisplay.textContent = '未提取';
        alert(`提取失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        extractBtn.disabled = false;
        extractBtn.textContent = '提取';
    }
}

// 文本分析API提取 (Deepseek)
async function extractWithTextAPI(row, extractBtn, sellingPoint, extractDisplay) {
    // 验证设置
    if (!aiSettings.textApiBaseUrl || !aiSettings.textApiKey) {
        alert('请先按J键配置文本分析API设置！');
        return;
    }

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
        } else {
            throw new Error('API返回数据格式错误');
        }

    } catch (error) {
        console.error('文本分析失败:', error);
        extractDisplay.textContent = '未提取';
        alert(`分析失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        extractBtn.disabled = false;
        extractBtn.textContent = '提取';
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
        }
    }

    // 关闭弹窗
    document.getElementById('extractEditModal').style.display = 'none';
    currentEditingRowId = null;
}

// 显示提示词模式选择弹窗
function showPromptModeModal(row, type) {
    currentPromptModeRow = row;
    currentPromptModeType = type;
    document.getElementById('promptModeModal').style.display = 'flex';
}

// 关闭提示词模式选择弹窗
function closePromptModeModal() {
    document.getElementById('promptModeModal').style.display = 'none';
    currentPromptModeRow = null;
    currentPromptModeType = null;
}

// 处理模式选择
function handleModeSelection(mode) {
    closePromptModeModal();

    if (mode === 'amazon') {
        // 亚马逊模式：执行原有的生成提示词逻辑
        const rowId = currentPromptModeRow.dataset.rowId;
        generatePrompts(rowId, currentPromptModeType);
    } else if (mode === 'free') {
        // 自由模式：显示文本输入框
        showFreePromptModal(currentPromptModeRow, currentPromptModeType);
    }
}

// 显示自由模式输入弹窗
function showFreePromptModal(row, type) {
    currentPromptModeRow = row;
    currentPromptModeType = type;
    document.getElementById('freePromptTextarea').value = '';
    document.getElementById('freePromptModal').style.display = 'flex';
}

// 关闭自由模式输入弹窗
function closeFreePromptModal() {
    document.getElementById('freePromptModal').style.display = 'none';
}

// 保存自由模式提示词
function saveFreePrompt() {
    const freeText = document.getElementById('freePromptTextarea').value.trim();

    if (!freeText) {
        alert('请输入提示词内容！');
        return;
    }

    // 将自由输入的文本作为单个提示词保存
    const prompts = [{
        title: '自由提示词',
        content: freeText
    }];

    // 显示提示词结果
    displayPromptResults(currentPromptModeRow, prompts, currentPromptModeType);

    // 关闭弹窗
    closeFreePromptModal();
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
            const analyzedPrompts = await analyzePromptsWithAI(result);

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
        const extractText = extractDisplay.textContent.trim();
        if (extractText &&
            extractText !== '未提取' &&
            !extractText.includes('正在分析') &&
            !extractText.includes('提取中') &&
            !extractText.includes('分析中')) {
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

// 使用AI分析提示词结构
async function analyzePromptsWithAI(text) {
    try {
        // 构建分析提示词
        const analysisPrompt = `请分析以下文本，识别其中包含多少个图片提示词，并为每个提示词提取一个简短的中文标题（不超过30个字符）。

文本内容：
${text}

请严格按照以下JSON格式返回结果，确保JSON格式正确，不要添加任何其他说明文字：
[
  {"title": "图片1的简短中文标题", "content": "图片1的完整英文提示词内容"},
  {"title": "图片2的简短中文标题", "content": "图片2的完整英文提示词内容"}
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
            throw new Error('AI分析失败');
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            let result = data.choices[0].message.content.trim();

            // 尝试解析JSON
            try {
                // 方法1: 提取 ```json 代码块
                const jsonBlockMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch) {
                    result = jsonBlockMatch[1].trim();
                }

                // 方法2: 提取 ``` 代码块（不带json标记）
                if (!jsonBlockMatch) {
                    const codeBlockMatch = result.match(/```\s*([\s\S]*?)\s*```/);
                    if (codeBlockMatch) {
                        result = codeBlockMatch[1].trim();
                    }
                }

                // 方法3: 提取第一个 [ 到最后一个 ] 之间的内容
                const arrayMatch = result.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    result = arrayMatch[0];
                }

                // 清理可能的问题字符
                result = result
                    .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
                    .replace(/,(\s*[}\]])/g, '$1') // 移除多余的逗号
                    .trim();

                const prompts = JSON.parse(result);

                // 验证格式
                if (Array.isArray(prompts) && prompts.length > 0) {
                    // 验证每个元素都有 title 和 content
                    const isValid = prompts.every(p => p.title && p.content);
                    if (isValid) {
                        console.log('AI分析成功，提取到', prompts.length, '个提示词');
                        return prompts;
                    }
                }
            } catch (e) {
                console.error('JSON解析失败，使用备用解析方法:', e);
                console.log('原始返回内容:', result);
            }
        }
    } catch (error) {
        console.error('AI分析失败，使用备用解析方法:', error);
    }

    // 如果AI分析失败，使用原有的解析方法
    console.log('使用备用解析方法');
    return parsePrompts(text);
}

// 解析提示词（备用方法）
function parsePrompts(text) {
    const prompts = [];

    // 方式1: 按 "### Image" 或 "### 图" 标记分割（Markdown格式）
    let matches = text.match(/###\s*(Image|图)\s*\d+[：:：]?[\s\S]*?(?=###\s*(Image|图)\s*\d+|$)/gi);

    if (!matches || matches.length === 0) {
        // 方式2: 按 "**Image" 或 "**图" 标记分割
        matches = text.match(/\*\*\s*(Image|图)\s*\d+[：:：]?[\s\S]*?(?=\*\*\s*(Image|图)\s*\d+|$)/gi);
    }

    if (!matches || matches.length === 0) {
        // 方式3: 按数字序号分割 "1."、"2." 等，但要求后面有实质内容
        matches = text.match(/\d+\.\s+[^\n]+[\s\S]*?(?=\n\d+\.\s+|$)/g);
    }

    if (!matches || matches.length === 0) {
        // 方式4: 按 "Image 1:"、"图1:" 等标记分割
        matches = text.match(/(Image|图)\s*\d+[：:：]\s*[\s\S]*?(?=(Image|图)\s*\d+[：:：]|$)/gi);
    }

    if (matches && matches.length > 0) {
        matches.forEach((match, index) => {
            const content = match.trim();

            // 过滤掉太短的内容（少于20个字符）
            if (content.length < 20) {
                return;
            }

            // 过滤掉只有标题没有内容的
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            if (lines.length < 2) {
                return;
            }

            // 提取标题
            let title = lines[0].trim();

            // 清理标题中的Markdown标记和序号
            title = title.replace(/^(###|\*\*|图\s*\d+[：:：]?|Image\s*\d+[：:：]?|\d+\.\s*)/, '').trim();
            title = title.replace(/(\*\*|###)$/, '').trim();

            // 如果标题为空，使用第二行
            if (!title && lines.length > 1) {
                title = lines[1].trim();
                title = title.replace(/^(###|\*\*|图\s*\d+[：:：]?|Image\s*\d+[：:：]?|\d+\.\s*)/, '').trim();
            }

            // 如果标题太长，截取前50个字符
            if (title.length > 50) {
                title = title.substring(0, 50) + '...';
            }

            // 如果标题仍为空，使用默认标题
            if (!title || title === '---' || title === '...') {
                title = `提示词 ${index + 1}`;
            }

            prompts.push({
                title: title,
                content: content
            });
        });
    }

    return prompts;
}

// 显示提示词结果
function displayPromptResults(row, prompts, type) {
    const promptCell = row.querySelector('td:nth-child(6)'); // F列
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

    // 点击展开/收起
    expandBtn.addEventListener('click', function() {
        // 从按钮读取最新的提示词数据
        const latestPrompts = expandBtn.promptsData;
        togglePromptExpand(row, latestPrompts, type);
    });

    resultContainer.appendChild(expandBtn);
}

// 切换提示词展开/收起
function togglePromptExpand(row, prompts, type) {
    const rowId = row.dataset.rowId;
    const existingExpandRow = document.querySelector(`tr.prompt-expand-row[data-parent-row="${rowId}"]`);

    if (existingExpandRow) {
        // 如果已经展开，则收起
        existingExpandRow.remove();
        const btn = row.querySelector('.prompt-expand-btn');
        btn.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${prompts.length}个) ▼`;
    } else {
        // 展开提示词
        const expandRow = document.createElement('tr');
        expandRow.className = 'prompt-expand-row';
        expandRow.dataset.parentRow = rowId;

        const expandCell = document.createElement('td');
        expandCell.colSpan = 10;
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
        const btn = row.querySelector('.prompt-expand-btn');
        btn.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${prompts.length}个) ▲`;

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
                btn.textContent = `${type === 'main' ? '主图' : 'A+'}提示词 (${prompts.length}个) ▼`;
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
        return; // 如果没有展开，不需要更新
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
    rows.forEach((row, index) => {
        row.querySelector('.row-number').textContent = index + 1;
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

// ========== 数据保存/加载功能 ==========

// 收集所有数据
function collectAllData() {
    const rows = document.querySelectorAll('#tableBody tr');
    const rowsData = [];

    rows.forEach(row => {
        const rowId = row.dataset.rowId;

        // 卖点
        const sellingPointInput = row.querySelector('.selling-point-input');
        const sellingPoint = sellingPointInput ? sellingPointInput.value : '';

        // 提取结果
        const extractDisplay = row.querySelector('.extract-display');
        const extractResult = extractDisplay ? extractDisplay.textContent : '';

        // 商品图片
        const productPreview = row.querySelector('.product-preview');
        const productImage = (productPreview && productPreview.src && productPreview.src !== window.location.href)
            ? productPreview.src : '';

        // 参考图片
        const referenceImages = row.referenceImages || [];

        // 尺寸
        const sizeSelect = row.querySelector('.size-select');
        const sizeCustom = row.querySelector('.size-custom');
        const size = sizeSelect ? sizeSelect.value : '1:1';
        const customSize = (sizeCustom && sizeCustom.style.display !== 'none') ? sizeCustom.value : '';

        // 结果图片
        const resultDisplay = row.querySelector('.image-display');
        const resultImg = resultDisplay ? resultDisplay.querySelector('img') : null;
        const resultImage = (resultImg && resultImg.src) ? resultImg.src : '';

        // 历史图片
        const historyImages = row.historyImages || [];

        // 图片与提示词的映射关系
        const imagePromptMap = row.imagePromptMap || [];

        // 提示词数据
        const prompts = {
            main: {
                data: [],
                checkStates: []
            },
            aplus: {
                data: [],
                checkStates: []
            }
        };

        // 收集提示词数据
        const promptBtn = row.querySelector('.prompt-expand-btn');
        if (promptBtn && promptBtn.promptsData) {
            const type = promptBtn.dataset.type;
            prompts[type].data = promptBtn.promptsData;
            prompts[type].checkStates = row.promptCheckStates && row.promptCheckStates[type]
                ? row.promptCheckStates[type]
                : [];
        }

        rowsData.push({
            rowId: parseInt(rowId),
            sellingPoint,
            extractResult,
            productImage,
            referenceImages,
            size,
            customSize,
            resultImage,
            historyImages,
            imagePromptMap,
            prompts
        });
    });

    return {
        version: '1.0',
        savedAt: new Date().toISOString(),
        rows: rowsData,
        settings: {
            imageApiKey: aiSettings.imageApiKey,
            textApiKey: aiSettings.textApiKey,
            imageGenApiKey: aiSettings.imageGenApiKey,
            templates: {
                imagePromptTemplate: aiSettings.imagePromptTemplate,
                textPromptTemplate: aiSettings.textPromptTemplate,
                mainImageTemplate: aiSettings.mainImageTemplate,
                aplusTemplate: aiSettings.aplusTemplate
            }
        }
    };
}

// 保存到JSON文件
function saveToJSON() {
    console.log('saveToJSON 函数被调用');
    try {
        // 收集数据
        const data = collectAllData();
        console.log('收集到的数据:', data);

        // 统计信息
        const rowCount = data.rows.length;
        const imageCount = data.rows.reduce((sum, row) => {
            let count = 0;
            if (row.productImage) count++;
            count += row.referenceImages.length;
            if (row.resultImage) count++;
            count += row.historyImages.length;
            return sum + count;
        }, 0);

        // 确认保存
        if (!confirm(`将保存 ${rowCount} 行数据，包含 ${imageCount} 张图片。\n\n是否继续？`)) {
            return;
        }

        // 转换为JSON字符串
        const jsonString = JSON.stringify(data, null, 2);

        // 创建Blob
        const blob = new Blob([jsonString], { type: 'application/json' });

        // 生成文件名
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        const filename = `智能表格_${dateStr}_${timeStr}.json`;

        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('数据保存成功！');
    } catch (error) {
        console.error('保存失败:', error);
        alert(`保存失败: ${error.message}`);
    }
}

// 从JSON文件加载
function loadFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 确认加载
    if (!confirm('加载数据将清空当前所有内容，是否继续？')) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // 验证数据格式
            if (!data.version || !data.rows) {
                throw new Error('无效的数据格式');
            }

            // 恢复数据
            restoreData(data);

            alert(`成功加载 ${data.rows.length} 行数据！`);
        } catch (error) {
            console.error('加载失败:', error);
            alert(`加载失败: ${error.message}\n\n请确保文件格式正确。`);
        }
    };

    reader.onerror = function() {
        alert('文件读取失败！');
    };

    reader.readAsText(file);

    // 清空input，允许重复加载同一文件
    event.target.value = '';
}

// 恢复数据
function restoreData(data) {
    // 清空现有数据
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    rowCount = 0;
    selectedRows.clear();
    lastClickedRowId = null;
    promptGeneratingRows.clear();

    // 恢复设置
    if (data.settings) {
        if (data.settings.imageApiKey) {
            aiSettings.imageApiKey = data.settings.imageApiKey;
        }
        if (data.settings.textApiKey) {
            aiSettings.textApiKey = data.settings.textApiKey;
        }
        if (data.settings.imageGenApiKey) {
            aiSettings.imageGenApiKey = data.settings.imageGenApiKey;
        }
        if (data.settings.templates) {
            if (data.settings.templates.imagePromptTemplate) {
                aiSettings.imagePromptTemplate = data.settings.templates.imagePromptTemplate;
            }
            if (data.settings.templates.textPromptTemplate) {
                aiSettings.textPromptTemplate = data.settings.templates.textPromptTemplate;
            }
            if (data.settings.templates.mainImageTemplate) {
                aiSettings.mainImageTemplate = data.settings.templates.mainImageTemplate;
            }
            if (data.settings.templates.aplusTemplate) {
                aiSettings.aplusTemplate = data.settings.templates.aplusTemplate;
            }
        }
        // 保存设置到localStorage
        localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
    }

    // 恢复每一行
    data.rows.forEach(rowData => {
        // 添加新行
        addRow();

        const row = tbody.lastElementChild;

        // 恢复卖点
        if (rowData.sellingPoint) {
            const sellingPointInput = row.querySelector('.selling-point-input');
            sellingPointInput.value = rowData.sellingPoint;
            // 显示提取按钮
            const extractBtn = row.querySelector('.extract-btn');
            extractBtn.style.display = 'block';
        }

        // 恢复提取结果
        if (rowData.extractResult) {
            const extractDisplay = row.querySelector('.extract-display');
            extractDisplay.textContent = rowData.extractResult;
        }

        // 恢复商品图片
        if (rowData.productImage) {
            const productPreview = row.querySelector('.product-preview');
            const productUploadArea = row.querySelector('.product-upload');
            const productDeleteBtn = row.querySelector('.product-delete-btn');
            const productTextDeleteBtn = row.querySelector('.product-text-delete-btn');

            productPreview.src = rowData.productImage;
            productUploadArea.classList.add('has-image');
            productDeleteBtn.style.display = 'block';
            productTextDeleteBtn.style.display = 'inline-block';
        }

        // 恢复参考图片
        if (rowData.referenceImages && rowData.referenceImages.length > 0) {
            row.referenceImages = [...rowData.referenceImages];
            const referencePreview = row.querySelector('.reference-preview');
            const referenceUploadArea = row.querySelector('.reference-upload');
            const referenceDeleteBtn = row.querySelector('.reference-delete-btn');
            const galleryBtn = row.querySelector('.reference-gallery-btn');

            referencePreview.src = rowData.referenceImages[0];
            referenceUploadArea.classList.add('has-image');
            referenceDeleteBtn.style.display = 'block';
            galleryBtn.style.display = 'block';
        }

        // 恢复尺寸
        if (rowData.size) {
            const sizeSelect = row.querySelector('.size-select');
            sizeSelect.value = rowData.size;

            if (rowData.size === '自定义' && rowData.customSize) {
                const sizeCustom = row.querySelector('.size-custom');
                sizeCustom.style.display = 'block';
                sizeCustom.value = rowData.customSize;
            }
        }

        // 恢复结果图片
        if (rowData.resultImage) {
            const resultDisplay = row.querySelector('.image-display');
            resultDisplay.classList.remove('empty');
            resultDisplay.innerHTML = `<img src="${rowData.resultImage}" alt="生成结果">`;
        }

        // 恢复历史图片
        if (rowData.historyImages && rowData.historyImages.length > 0) {
            row.historyImages = [...rowData.historyImages];
            const thumbnailsContainer = row.querySelector('.history-thumbnails');
            const historyGalleryBtn = row.querySelector('.history-gallery-btn');
            const historyDownloadBtn = row.querySelector('.history-download-btn');

            thumbnailsContainer.innerHTML = '';
            rowData.historyImages.forEach((imgUrl, index) => {
                const thumbnail = document.createElement('div');
                thumbnail.className = 'history-thumbnail';
                thumbnail.innerHTML = `<img src="${imgUrl}" alt="历史${index + 1}">`;
                thumbnail.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showImageModal(imgUrl, row.historyImages, index);
                });
                thumbnailsContainer.appendChild(thumbnail);
            });

            historyGalleryBtn.style.display = 'block';
            if (historyDownloadBtn) {
                historyDownloadBtn.style.display = 'block';
            }
        }

        // 恢复图片与提示词的映射关系
        if (rowData.imagePromptMap && rowData.imagePromptMap.length > 0) {
            row.imagePromptMap = [...rowData.imagePromptMap];
        }

        // 恢复提示词
        if (rowData.prompts) {
            // 恢复主图提示词
            if (rowData.prompts.main && rowData.prompts.main.data && rowData.prompts.main.data.length > 0) {
                displayPromptResults(row, rowData.prompts.main.data, 'main');
                if (rowData.prompts.main.checkStates) {
                    row.promptCheckStates = row.promptCheckStates || {};
                    row.promptCheckStates.main = rowData.prompts.main.checkStates;
                }
            }

            // 恢复A+提示词
            if (rowData.prompts.aplus && rowData.prompts.aplus.data && rowData.prompts.aplus.data.length > 0) {
                displayPromptResults(row, rowData.prompts.aplus.data, 'aplus');
                if (rowData.prompts.aplus.checkStates) {
                    row.promptCheckStates = row.promptCheckStates || {};
                    row.promptCheckStates.aplus = rowData.prompts.aplus.checkStates;
                }
            }
        }
    });

    // 更新工具栏
    updateSelectionUI();
}
