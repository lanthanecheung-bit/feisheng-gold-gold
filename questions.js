/**
 * Static IQ + animal + math-riddle quiz banks (zh-Hant HK).
 * Each item: text, answer, distractors[2]. Choices shuffled at runtime.
 */
window.FeishengQuestionBank = {
  iq: [
    {
      text: "邊一個月有28日？",
      answer: "每個月都有28日",
      distractors: ["只有二月", "閏年嘅二月"],
    },
    {
      text: "一斤鐵同一斤棉花，邊樣重啲？",
      answer: "一樣重，都係一斤",
      distractors: ["鐵重啲", "棉花重啲"],
    },
    {
      text: "咩嘢有四隻腳，但係唔識行路？",
      answer: "檯（同櫈）",
      distractors: ["貓", "龜"],
    },
    {
      text: "咩嘢有牙，但係從來唔會咬人？",
      answer: "梳",
      distractors: ["牙刷", "鋸"],
    },
    {
      text: "咩嘢有「面」又識「行」，但係冇腳？",
      answer: "時鐘",
      distractors: ["麵包", "地圖"],
    },
    {
      text: "咩嘢愈用愈短？",
      answer: "鉛筆／擦膠",
      distractors: ["尺", "書"],
    },
    {
      text: "咩嘢要打爛咗先至用得？",
      answer: "雞蛋",
      distractors: ["西瓜", "核桃"],
    },
    {
      text: "小明媽媽有三個仔：大仔叫一月，二仔叫二月，三仔叫咩名？",
      answer: "小明",
      distractors: ["三月", "十二月"],
    },
    {
      text: "咩嘢愈多人分就愈多？",
      answer: "快樂",
      distractors: ["蛋糕", "錢"],
    },
    {
      text: "咩嘢係你嘅，但係人哋用得多過你自己？",
      answer: "你個名",
      distractors: ["你部電話", "你啲錢"],
    },
    {
      text: "咩嘢車最多人自動讓路？",
      answer: "救護車同消防車",
      distractors: ["巴士", "的士"],
    },
    {
      text: "咩嘢字，全世界啲人都一定會「讀錯」？",
      answer: "「錯」字",
      distractors: ["「難」字", "「愛」字"],
    },
    {
      text: "咩嘢冬天先出現，太陽一出嚟就慢慢唔見咗？",
      answer: "雪人",
      distractors: ["北極熊", "雪糕"],
    },
    {
      text: "咩嘢一講出口，就即刻唔再屬於你？",
      answer: "秘密",
      distractors: ["說話", "空氣"],
    },
    {
      text: "咩嘢細個四隻腳、大個兩隻腳、老咗三隻腳？",
      answer: "人",
      distractors: ["狗", "猴子"],
    },
  ],
  animal: [
    {
      text: "咩嘢老鼠用兩隻腳行路？",
      answer: "米奇老鼠",
      distractors: ["倉鼠", "飛鼠"],
    },
    {
      text: "邊種鴨用兩隻腳行路？",
      answer: "所有鴨",
      distractors: ["唐老鴨", "北京鴨"],
    },
    {
      text: "豹同狗百米賽跑，豹比狗跑得快，點解狗先到終點？",
      answer: "豹跑錯咗方向",
      distractors: ["狗識抄近路", "豹去咗食飯"],
    },
    {
      text: "大雁點解要向南飛？",
      answer: "飛比用腳行快得多",
      distractors: ["南邊有米食", "怕凍"],
    },
    {
      text: "一條毛毛蟲要過對面岸，點樣過最快？",
      answer: "食哂啲葉，變成蝴蝶飛過去",
      distractors: ["游過去", "搭船"],
    },
    {
      text: "入動物園參觀，你最先見到邊種動物？",
      answer: "人",
      distractors: ["獅子", "大象"],
    },
    {
      text: "一隻雞同一隻鵝放入同一個雪櫃，點解只有雞被凍死？",
      answer: "嗰隻鵝其實係企鵝",
      distractors: ["雞比較瘦", "鵝有羽絨"],
    },
    {
      text: "咩情況一山可以藏二虎？",
      answer: "一公一母",
      distractors: ["兩隻都瞓緊", "其中一隻係紙老虎"],
    },
  ],
  mathRiddle: [
    {
      text: "咩情況下 2>5、5>0、0>2？",
      answer: "猜拳（剪刀石頭布）",
      distractors: ["計數計錯咗", "數字寫倒轉"],
    },
    {
      text: "「7÷2」猜一句成語",
      answer: "不三不四",
      distractors: ["七零八落", "二一添作五"],
    },
    {
      text: "「2 ≦ x ≦ 3」猜一句成語",
      answer: "接二連三",
      distractors: ["三心兩意", "二三其德"],
    },
    {
      text: "「2468」猜一句成語",
      answer: "無獨有偶",
      distractors: ["四通八達", "成雙成對"],
    },
    {
      text: "「7 8」猜一句成語",
      answer: "七上八下",
      distractors: ["亂七八糟", "七嘴八舌"],
    },
    {
      text: "一加一除咗等於二，仲可以等於咩？",
      answer: "王、田",
      distractors: ["十一", "三"],
    },
    {
      text: "餐廳一個人消費要 700 元，點解兩對母女用餐只要 2100 元？",
      answer: "奶奶、媽媽、女兒一齊用餐（其實得三人）",
      distractors: ["餐廳有買二送一", "其中一對唔食嘢"],
    },
    {
      text: "邊個數字最懶惰，邊個數字最勤快？",
      answer: "「一」不做、「二」不休",
      distractors: ["「零」最懶、「九」最勤", "「三」最懶、「八」最勤"],
    },
    {
      text: "三個人分四顆蘋果，點分最公平？",
      answer: "打成果汁",
      distractors: ["每人一顆，剩一顆丟掉", "切成十二塊平均分"],
    },
    {
      text: "哥哥 4 歲，弟弟是他歲數的一半。當哥哥 100 歲時，弟弟會是幾歲？",
      answer: "98 歲",
      distractors: ["50 歲", "100 歲"],
    },
    {
      text: "5 隻貓同時吃 5 條魚，需要 5 分鐘才能吃完。按同樣速度，100 隻貓要多久才能吃完 100 條魚？",
      answer: "5 分鐘",
      distractors: ["100 分鐘", "20 分鐘"],
    },
    {
      text: "一個時鐘敲 6 下需要 30 秒，那麼敲 12 下需要幾秒？（提示：唔係 60 秒）",
      answer: "66 秒",
      distractors: ["60 秒", "72 秒"],
    },
    {
      text: "甚麼時候 4 減 1 等於 5？",
      answer: "算錯嘅時候",
      distractors: ["永遠唔會", "用羅馬數字時（IV−I＝III）"],
    },
  ],
};
