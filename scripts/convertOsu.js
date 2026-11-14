/**
 * Script chạy độc lập để chuyển đổi file .osu hoặc .osz thành Triarhythm Beatmap JSON
 * Cách dùng:
 *   node scripts/convertOsu.js
 *   node scripts/convertOsu.js <đường_dẫn_tới_file.osu_hoặc_file.zip>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseOsu, importPackage } from '../src/core/parser/index.js';
import { validateBeatmap } from '../src/core/beatmap/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  let targetPath = args[0];

  // Nếu không truyền đường dẫn, sử dụng file mẫu Beyond The Aexis mặc định
  if (!targetPath) {
    targetPath = path.resolve(
      __dirname,
      '../tests/fixtures/beyond-the-aexis/2025310 SDMNE - Beyond The Aexis/SDMNE - Beyond The Aexis (ERA Akiri) [Soulless Wanderers].osu'
    );
    console.log(`[Triarhythm CLI] Không chỉ định file, sử dụng file mẫu mặc định:`);
    console.log(`  ${targetPath}\n`);
  }

  if (!fs.existsSync(targetPath)) {
    console.error(`[Lỗi] File không tồn tại: ${targetPath}`);
    process.exit(1);
  }

  const isZipOrOsz = targetPath.endsWith('.osz') || targetPath.endsWith('.zip');

  try {
    let beatmap;
    let statsInfo;

    if (isZipOrOsz) {
      console.log(`[Triarhythm CLI] Đang mở gói nén: ${path.basename(targetPath)}...`);
      const buffer = fs.readFileSync(targetPath);
      const pkgResult = await importPackage(buffer, { preset: 'medium' });
      beatmap = pkgResult.primaryBeatmap;
      statsInfo = {
        title: beatmap.metadata.title,
        artist: beatmap.metadata.artist,
        difficulties: pkgResult.availableDifficulties
      };
    } else {
      console.log(`[Triarhythm CLI] Đang phân tích file .osu: ${path.basename(targetPath)}...`);
      const text = fs.readFileSync(targetPath, 'utf8');
      const parseResult = parseOsu(text, { preset: 'medium' });
      beatmap = parseResult.beatmap;
      statsInfo = {
        title: beatmap.metadata.title,
        artist: beatmap.metadata.artist,
        rawStats: parseResult.rawStats,
        reductionStats: parseResult.reductionStats,
        mappingStats: parseResult.mappingStats
      };
    }

    // Kiểm tra hợp lệ bằng validateBeatmap
    const validation = validateBeatmap(beatmap);
    console.log('\n======================================================');
    console.log(' THÔNG TIN CHUYỂN ĐỔI BEATMAP THÀNH CÔNG');
    console.log('======================================================');
    console.log(`Bài hát:       ${beatmap.metadata.title} - ${beatmap.metadata.artist}`);
    console.log(`Độ khó:        ${beatmap.metadata.difficultyName}`);
    console.log(`Số timing gốc: ${beatmap.timingPoints.length}`);
    console.log(`Số nốt đã gán: ${beatmap.notes.length}`);
    console.log(`Layout ID:     ${beatmap.layout}`);
    console.log(`Kiểm tra hợp lệ: ${validation.valid ? 'HỢP LỆ (PASS)' : 'CÓ LỖI'}`);
    if (validation.warnings.length > 0) {
      console.log(`Cảnh báo (${validation.warnings.length}):`, validation.warnings);
    }
    console.log('======================================================\n');

    // Xuất file JSON
    const outputDir = path.resolve(__dirname, '../dist_beatmaps');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputName = `${beatmap.metadata.title.replace(/[^\w\s-]/gi, '')}_${beatmap.metadata.difficultyName}.json`;
    const outputPath = path.join(outputDir, outputName);
    fs.writeFileSync(outputPath, JSON.stringify(beatmap, null, 2), 'utf8');
    console.log(`[Triarhythm CLI] Đã xuất beatmap thành công ra file:\n  ${outputPath}\n`);
  } catch (err) {
    console.error('[Lỗi chuyển đổi]', err);
    process.exit(1);
  }
}

main();
