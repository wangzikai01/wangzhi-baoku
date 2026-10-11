(function () {
  var out = {};

  out['1_页面'] = {
    当前页: document.querySelector('.screen.on').id,
    标题: document.querySelector('.tb-title').textContent,
    有名称框: !!document.getElementById('fName'),
    有时间框: !!document.getElementById('fDate'),
    时间默认: document.getElementById('fDate').value,
    有拍照: !!document.getElementById('btnCamera'),
    有相册: !!document.getElementById('btnGallery'),
    文件输入框: [].map.call(document.querySelectorAll('input[type=file]'), function (x) {
      return x.accept + (x.capture ? ' capture=' + x.capture : '');
    })
  };

  // ---- 2. 用 canvas 造一张假图片，走 handleFile 的完整流程 ----
  return new Promise(function (res) {
    var c = document.createElement('canvas');
    c.width = 900; c.height = 600;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#3D5AFE'; ctx.fillRect(0, 0, 900, 600);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '60px sans-serif';
    ctx.fillText('奖学金证书', 250, 320);
    c.toBlob(function (blob) {
      var f = new File([blob], 'cert.jpg', { type: 'image/jpeg' });
      handleFile(f);
      setTimeout(function () {
        out['2_选图'] = {
          压缩后尺寸: pending ? (pending.w + 'x' + pending.h) : '(没有)',
          缩略图长度: pending ? pending.thumb.length : 0,
          大图字节: pending ? pending.big.size : 0,
          预览区变了: document.getElementById('picker').className
        };

        // ---- 3. 填名称、保存 ----
        document.getElementById('fName').value = '国家励志奖学金';
        document.getElementById('fDate').value = '2026-09-27';
        saveRec();

        setTimeout(function () {
          out['3_保存'] = {
            记录数: RECS.length,
            第一条: RECS[0] ? { 名称: RECS[0].name, 时间: RECS[0].date, 尺寸: RECS[0].w + 'x' + RECS[0].h } : null,
            localStorage字节: (localStorage.getItem('zz-meta-v1') || '').length
          };

          // ---- 4. 再存一条 ----
          c.toBlob(function (b2) {
            handleFile(new File([b2], 'c2.jpg', { type: 'image/jpeg' }));
            setTimeout(function () {
              document.getElementById('fName').value = '优秀学生干部';
              document.getElementById('fDate').value = '2026-06-15';
              saveRec();
              setTimeout(function () {
                // ---- 5. 看列表页 ----
                show('list'); renderList();
                out['4_列表'] = {
                  记录数: RECS.length,
                  列表卡片数: document.querySelectorAll('#listBody .rec').length,
                  有导出按钮: !!document.getElementById('btnExport'),
                  有清空按钮: !!document.getElementById('btnClear'),
                  缩略图是图片: document.querySelectorAll('#listBody img.thumb').length
                };

                // ---- 6. 生成 Word（不真的保存，只验证 zip 能不能生成） ----
                var blobs = {};
                var left = RECS.length, failed = 0;
                RECS.forEach(function (r) {
                  getImg(r.id, function (bl) {
                    if (!bl) { failed++; if (--left === 0) step6(); return; }
                    bl.arrayBuffer().then(function (buf) {
                      blobs[r.id] = new Uint8Array(buf);
                      if (--left === 0) step6();
                    });
                  });
                });

                function step6() {
                  out['5_图片读回'] = { 成功: Object.keys(blobs).length, 失败: failed };
                  try {
                    var media = [], rels = [], body = '', pid = 1;
                    RECS.forEach(function (r, i) {
                      if (!blobs[r.id]) return;
                      var fn = 'image' + (i + 1) + '.jpg';
                      var rid = 'rId' + (i + 1);
                      media.push({ name: 'word/media/' + fn, data: blobs[r.id] });
                      rels.push(rid);
                      body += pText(esc(r.name) + '　　' + esc(r.date), true, 28);
                      var cx = Math.round((r.w || 1000) * 9525), cy = Math.round((r.h || 750) * 9525);
                      if (cx > EMU_MAXW) { cy = Math.round(cy * EMU_MAXW / cx); cx = EMU_MAXW; }
                      body += pImage(rid, pid++, cx, cy, fn);
                    });
                    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W_NS + '><w:body>' + body + '</w:body></w:document>';
                    var files = [
                      { name: '[Content_Types].xml', data: utf8('<?xml version="1.0"?><Types/>') },
                      { name: '_rels/.rels', data: utf8('<?xml version="1.0"?><Relationships/>') },
                      { name: 'word/document.xml', data: utf8(doc) },
                      { name: 'word/_rels/document.xml.rels', data: utf8('<?xml version="1.0"?><Relationships/>') }
                    ].concat(media);

                    var zip = makeZip(files);
                    // 检查 zip 头尾
                    var dv = new DataView(zip.buffer);
                    var head = dv.getUint32(0, true).toString(16);
                    // 找 EOCD
                    var eocdAt = -1;
                    for (var i = zip.length - 22; i >= 0; i--) {
                      if (dv.getUint32(i, true) === 0x06054b50) { eocdAt = i; break; }
                    }
                    var entries = eocdAt >= 0 ? dv.getUint16(eocdAt + 10, true) : -1;

                    out['6_Word生成'] = {
                      zip总字节: zip.length,
                      文件头: '0x' + head + (head === '4034b50' ? ' ✓PK' : ' ✗不是zip'),
                      中央目录位置: eocdAt,
                      压缩包内文件数: entries,
                      b64长度: u8b64(zip).length,
                      正文里有图片XML: doc.indexOf('w:drawing') > 0,
                      名称时间在一行: doc.indexOf('国家励志奖学金') > 0 && doc.indexOf('2026-09-27') > 0
                    };
                    // 把 doc 存到全局，方便待会儿看重排顺序
                    window.__doc = doc;
                  } catch (e) {
                    out['6_Word生成'] = { 出错: String(e) };
                  }
                  res(JSON.stringify(out, null, 1));
                }
              }, 900);
            }, 1500);
          }, 'image/jpeg', 0.9);
        }, 900);
      }, 1600);
    }, 'image/jpeg', 0.9);
  });
})()
