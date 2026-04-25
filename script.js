(function() {
    const SPARK = {
        appId: '0d9c0c4a',
        apiKey: 'b6b50517a9c8c106ab7e4199c846ace5',
        apiSecret: 'MzA1NmZiMmIwM2UwZDg5MjcyNDI1ZDZl',
        host: 'spark-api.xf-yun.com',
        path: '/v1.1/chat'
    };

    const inputText = document.getElementById('inputText');
    const charCount = document.getElementById('charCount');
    const resultEmpty = document.getElementById('resultEmpty');
    const resultContent = document.getElementById('resultContent');
    const guidanceEmpty = document.getElementById('guidanceEmpty');
    const guidanceList = document.getElementById('guidanceList');
    const translateResult = document.getElementById('translateResult');
    const btnDetect = document.getElementById('btnDetect');

    let ws = null;
    let pendingCallback = null;
    let accumulatedText = '';

    function getAuthUrl() {
        const date = new Date().toUTCString();
        const signStr = `host: ${SPARK.host}\ndate: ${date}\nGET ${SPARK.path} HTTP/1.1`;
        const signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(signStr, SPARK.apiSecret));
        const auth = `api_key="${SPARK.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
        return `wss://${SPARK.host}${SPARK.path}?authorization=${encodeURIComponent(btoa(auth))}&date=${encodeURIComponent(date)}&host=${SPARK.host}`;
    }

    function connect(callback) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            callback();
            return;
        }
        ws = new WebSocket(getAuthUrl());
        ws.onopen = () => {
            console.log('🌟 WebSocket 已连接');
            callback();
        };
        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.header.code !== 0) {
                showToast('AI 服务错误: ' + (data.header.message || '未知错误'), 'warning');
                if (pendingCallback) pendingCallback = null;
                return;
            }
            const content = data.payload?.choices?.text?.[0]?.content;
            if (content) accumulatedText += content;
            if (data.header.status === 2 && pendingCallback) {
                const finalText = accumulatedText;
                accumulatedText = '';
                pendingCallback(finalText);
                pendingCallback = null;
            }
        };
        ws.onerror = () => {
            showToast('WebSocket 连接失败，请检查网络', 'warning');
            if (pendingCallback) pendingCallback = null;
        };
    }

    function sendSpark(sysPrompt, userText, onResult) {
        accumulatedText = '';
        pendingCallback = onResult;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connect(() => sendSpark(sysPrompt, userText, onResult));
            return;
        }
        const request = {
            header: { app_id: SPARK.appId, uid: "user1" },
            parameter: { chat: { domain: "lite", temperature: 0.5, max_tokens: 4096 } },
            payload: {
                message: {
                    text: [
                        { role: "system", content: sysPrompt },
                        { role: "user", content: userText }
                    ]
                }
            }
        };
        ws.send(JSON.stringify(request));
    }

    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        const colors = { success: '#059669', warning: '#D97706', info: '#4F46E5' };
        toast.style.background = colors[type] || colors.info;
        toast.textContent = msg;
        document.getElementById('toastContainer').appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function escapeHTML(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function updateCharCount() {
        const text = inputText.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        charCount.textContent = `词数: ${words} | 字符: ${text.length}`;
    }
    inputText.addEventListener('input', updateCharCount);

    window.loadExample = () => {
        inputText.value = `Artificial intelligence has become an integral part of modern education. Many students rely on AI tools for language learning and writing assistance. However, it is crucial to maintain academic integrity. Students should use AI to improve their grammar and vocabulary, but the core ideas must come from their own thinking. Over-dependence on AI may weaken critical thinking skills.`;
        updateCharCount();
        showToast('示例已加载', 'info');
    };

    window.pasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) { inputText.value = text; updateCharCount(); showToast('已粘贴', 'success'); }
            else showToast('剪贴板为空', 'warning');
        } catch { showToast('无法访问剪贴板', 'warning'); }
    };

    window.openTranslateModal = () => {
        if (!inputText.value.trim()) { showToast('请先输入英文内容', 'warning'); return; }
        document.getElementById('translateOverlay').classList.add('active');
        performTranslation();
    };

    window.performTranslation = () => {
        const text = inputText.value.trim();
        if (!text) return;
        translateResult.innerHTML = '<p>⏳ AI 翻译中...</p>';
        sendSpark('你是一个翻译助手。请将以下英文翻译成中文，只输出译文。', text, (res) => {
            translateResult.innerHTML = `<p><strong>🔤 原文：</strong></p><p>${escapeHTML(text)}</p><p style="margin-top:12px;"><strong>🀄️ 译文：</strong></p><p>${escapeHTML(res)}</p>`;
        });
    };

    window.openGuide = () => document.getElementById('guideOverlay').classList.add('active');

    function robustParse(raw) {
        const result = {
            originality: 50,
            aiDependency: 50,
            riskLevel: 'medium',
            sentences: [],
            summary: ''
        };

        const origMatch = raw.match(/原创性\s*[=：]\s*(\d+)/);
        if (origMatch) result.originality = parseInt(origMatch[1]);
        const depMatch = raw.match(/AI依赖\s*[=：]\s*(\d+)/);
        if (depMatch) result.aiDependency = parseInt(depMatch[1]);
        const riskMatch = raw.match(/风险\s*[=：]\s*(low|medium|high)/i);
        if (riskMatch) result.riskLevel = riskMatch[1].toLowerCase();
        else {
            result.riskLevel = result.originality >= 70 ? 'low' : result.originality >= 45 ? 'medium' : 'high';
        }
        const sumMatch = raw.match(/总结\s*[=：]\s*(.+?)(?:\n|$)/);
        if (sumMatch) result.summary = sumMatch[1].trim();
        else result.summary = '请参考逐句建议优化文本。';

        const lines = raw.split('\n');
        for (const line of lines) {
            if (/原创性|AI依赖|风险|总结/.test(line)) continue;
            const parts = line.split(/\s*[-–—]\s*/);
            if (parts.length >= 2) {
                const original = parts[0].trim();
                if (original.length < 10) continue;
                const isAI = /AI|是/.test(parts[1]);
                let suggestion = parts.length >= 3 ? parts[2].trim() : '';
                if (!suggestion || suggestion === original) {
                    suggestion = isAI ? '建议改用个人视角表达，例如“In my opinion...”' : '表达自然，可保留。';
                }
                result.sentences.push({
                    original: original,
                    isAI: isAI,
                    suggestion: suggestion
                });
            }
        }

        if (result.sentences.length === 0) {
            const rawSentences = raw.split(/[.!?]+/).filter(s => s.trim().length > 10);
            result.sentences = rawSentences.map(s => ({
                original: s.trim(),
                isAI: false,
                suggestion: '表达自然，可保留。'
            }));
        }

        return result;
    }

    window.runDetection = () => {
        const text = inputText.value.trim();
        if (!text) return showToast('请输入英文文本', 'warning');
        if (text.split(/\s+/).length < 15) return showToast('至少15词', 'warning');

        btnDetect.disabled = true;
        btnDetect.innerHTML = '⏳ 分析中...';
        resultContent.classList.remove('active');
        resultEmpty.style.display = 'flex';
        resultEmpty.innerHTML = '<p>AI 正在分析文本原创性…</p>';
        guidanceList.style.display = 'none';
        guidanceEmpty.style.display = 'flex';

        const sysPrompt = `你是学术写作检测专家。请分析下面的英文文本，判断每个句子是否像AI生成的（句式过于模板化、缺乏个人观点、表达生硬）。你必须严格使用中文标签输出，格式如下：
原创性=80
AI依赖=20
风险=low
总结=这句话是对整体的评价
然后每一个句子一行，格式为：
原句 - 判断(填“AI”或“人类”) - 修改建议（若判断为AI，给出不同风格的个人化改写；若判断为人类，写“无需修改”）
注意：修改建议必须与原句不同，并体现个人视角。`;

        sendSpark(sysPrompt, text, (response) => {
            console.log('AI原始回复:', response);
            const data = robustParse(response);
            updateUI(data);
            btnDetect.disabled = false;
            btnDetect.innerHTML = '🔍 开始检测';
        });
    };

    function updateUI(data) {
        const { originality, aiDependency, riskLevel, sentences, summary } = data;
        const color = originality >= 70 ? '#10B981' : originality >= 45 ? '#F59E0B' : '#EF4444';
        let html = `
            <div style="display:flex; gap:16px; align-items:center;">
                <div class="score-circle" style="background: conic-gradient(${color} ${originality}%, #E2E8F0 0);">
                    <div class="inner">
                        <strong style="font-size:1.3rem;">${originality}%</strong>
                        <span style="font-size:0.6rem;">原创</span>
                    </div>
                </div>
                <div>
                    <div style="font-weight:600;">AI依赖: ${aiDependency}%</div>
                    <div style="color:${color}; font-size:0.9rem;">${riskLevel === 'low' ? '低风险' : riskLevel === 'medium' ? '中等风险' : '高风险'}</div>
                </div>
            </div>
            <div style="font-weight:700; margin-top:8px;">📋 逐句分析与修改建议</div>`;
        sentences.forEach(s => {
            const cls = s.isAI ? 'problem' : 'safe';
            html += `<div class="sentence-item ${cls}">
                <strong>${s.isAI ? '⚠️ 疑似AI' : '✅ 自然'}</strong> ${escapeHTML(s.original)}
                <div style="color:#065F46; margin-top:4px;">💡 <strong>建议：</strong>${escapeHTML(s.suggestion)}</div>
            </div>`;
        });
        html += `<div style="background:#EFF6FF; padding:10px; border-radius:8px; margin-top:8px;">📌 ${escapeHTML(summary)}</div>`;
        resultContent.innerHTML = html;
        resultContent.classList.add('active');
        resultEmpty.style.display = 'none';

        generateDetailedGuidance(data);
    }

    function generateDetailedGuidance(data) {
        const { originality, aiDependency, riskLevel } = data;
        const guides = [];

        guides.push({
            title: '🎯 整体定位',
            text: `你的文本原创性得分为 ${originality}%，AI依赖度 ${aiDependency}%，属于<strong>${riskLevel === 'low' ? '低风险' : riskLevel === 'medium' ? '中等风险' : '高风险'}</strong>。${riskLevel === 'low' ? '整体原创性较高，仍可进一步打磨。' : riskLevel === 'medium' ? '文本中可能存在部分AI辅助痕迹，需要加强个人思考的表达。' : '文本高度疑似AI生成，强烈建议重新审视内容并融入个人观点。'}`
        });

        if (originality < 50) {
           guides.push({
    title: '🧩 提升原创性',
    text: `
        <div style="margin-top:6px;"><strong>• 重新梳理核心论点：</strong>问自己“我最想表达的是什么？”，用一句话概括，确保文章围绕自己的观点展开。</div>
        <div style="margin-top:4px;"><strong>• 加入个人经历或独特案例：</strong>从你的学习、生活或阅读中找一个具体的例子，替换掉模板化的论述。</div>
        <div style="margin-top:4px;"><strong>• 改变句式结构：</strong>AI生成的句子往往长度均匀、结构类似。试着混合使用短句、反问句、感叹句，让节奏有变化。</div>
    `
});
        } else if (originality < 70) {
            guides.push({
    title: '🧩 进一步提升原创性',
    text: `
        <div style="margin-top:6px;"><strong>• 深化个人见解：</strong>不要只陈述事实，加上你自己的评价或预测。例如把“This suggests that...”改为“In my view, this implies...”。</div>
        <div style="margin-top:4px;"><strong>• 减少通用表达：</strong>像“It is widely believed that...”这类句子可改为更具体的描述，比如“Recent studies by X indicate...”。</div>
    `
});
        } else {
            guides.push({
                title: '🧩 保持高水平原创',
                text: '你的文本原创度很好！接下来可以：<br>1. <strong>精炼语言</strong>：检查是否有冗余词汇，使表达更简洁有力。<br>2. <strong>增强逻辑连接</strong>：确保段落之间有清晰的过渡，让论述更流畅。'
            });
        }

        if (aiDependency > 30) {
           guides.push({
    title: '🤖 降低AI依赖性',
    text: `
        <div style="margin-top:6px;"><strong>• 限制AI的使用范围：</strong>只把AI用于语法检查、词汇替换，<strong>不要让它生成整句或段落</strong>。</div>
        <div style="margin-top:4px;"><strong>• 先自己写，再让AI润色：</strong>养成“先完成初稿，再借助AI优化”的习惯，这样能保持思维的主导权。</div>
        <div style="margin-top:4px;"><strong>• 对AI输出进行批判性修改：</strong>每次接受AI建议前，问自己“这样改真的更好吗？会不会失去我的语气？”</div>
    `
});
        }

        if (riskLevel === 'high') {
            guides.push({
    title: '⚠️ 高风险应对策略',
    text: `
        <div style="margin-top:6px;"><strong>• 从头重新构思：</strong>暂时放下当前文本，用纸笔写下你的核心想法，再用自己的话组织成句。</div>
        <div style="margin-top:4px;"><strong>• 分段重写：</strong>每次重写一个段落，并且尝试用与AI完全不同的表达方式。</div>
        <div style="margin-top:4px;"><strong>• 寻求同伴反馈：</strong>让同学读一读，看他们是否能感受到你的个人风格。如果听起来像教科书，就需要进一步修改。</div>
        <div style="margin-top:4px;"><strong>• 学习学术写作规范：</strong>参加学校提供的学术写作讲座或工作坊，增强自主写作能力。</div>
    `
});
        } else if (riskLevel === 'medium') {
            guides.push({
    title: '🔧 中等风险优化方法',
    text: `
        <div style="margin-top:6px;"><strong>• 逐段审查：</strong>标记出哪些句子感觉“不像自己写的”，重点关注这些部分。</div>
        <div style="margin-top:4px;"><strong>• 增加个人过渡：</strong>在段落之间添加自己的评论或过渡句，比如“This reminds me of...”或“A contrasting view is...”。</div>
        <div style="margin-top:4px;"><strong>• 调整语气：</strong>考虑受众，使用更口语化或更学术化的表达，让文本听起来更真实。</div>
    `
});
        }

        guides.push({
            title: '✍️ 通用英文写作提升技巧',
            text: '1. <strong>阅读优秀范文</strong>：多读原版学术文章，学习地道的表达方式和论证结构。<br>2. <strong>建立个人语料库</strong>：摘抄你喜欢的句子，分析其句型，尝试模仿。<br>3. <strong>定期练习自由写作</strong>：每周至少写一篇不限题目的短文，锻炼思维和表达能力。'
        });

        guides.push({
            title: '📜 合规使用AI温馨提示',
            text: '根据中北大学调研报告，85.3%的学生担心学术不端风险。请记住：<br>1. <strong>直接复制AI生成内容即属学术不端</strong>。<br>2. 如使用AI辅助，建议在作业中标注使用的工具和范围。<br>3. 核心观点、逻辑推演、个人分析必须由自己完成。'
        });

        guidanceList.innerHTML = '';
        guides.forEach(g => {
            const li = document.createElement('li');
            li.className = 'guidance-item';
            li.innerHTML = `<strong>${g.title}</strong>${g.text}`;
            guidanceList.appendChild(li);
        });
        guidanceList.style.display = 'flex';
        guidanceEmpty.style.display = 'none';
    }

    window.showQRModal = () => {
        document.getElementById('qrOverlay').classList.add('active');
        document.getElementById('customUrl').value = window.location.href;
        updateQRCode();
    };

    window.updateQRCode = () => {
        const qrContainer = document.getElementById('qrContainer');
        qrContainer.innerHTML = '';
        const url = document.getElementById('customUrl').value.trim() || window.location.href;
        new QRCode(qrContainer, {
            text: url,
            width: 180,
            height: 180,
            colorDark: '#1E293B',
            colorLight: '#FFFFFF'
        });
    };

    window.copyCurrentUrl = () => {
        navigator.clipboard.writeText(window.location.href).then(() => showToast('链接已复制', 'success'));
    };

    document.querySelectorAll('.overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    });

    updateCharCount();
    console.log('🚀 专属于你的英语小助手已就绪');
})();