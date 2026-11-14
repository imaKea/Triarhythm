<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PostsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Đảm bảo có ít nhất category id 1 và 2
        $cat1 = Category::firstOrCreate(['name' => 'Thế giới'], ['description' => 'Chuyên mục thông tin về Thế giới']);
        $cat2 = Category::firstOrCreate(['name' => 'Pháp luật'], ['description' => 'Chuyên mục thông tin về Pháp luật']);

        // Sử dụng Query Builder thêm dữ liệu vào bảng Posts bằng Seeder
        DB::table('posts')->insert([
            [
                'name' => 'Bài viết 7',
                'description' => 'Mô tả bài viết 7',
                'content' => 'Nội dung chi tiết của bài viết 7',
                'category_id' => $cat1->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Bài viết 8',
                'description' => 'Mô tả bài viết 8',
                'content' => 'Nội dung chi tiết của bài viết 8',
                'category_id' => $cat2->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Bài viết 9',
                'description' => 'Mô tả bài viết 9',
                'content' => 'Nội dung chi tiết của bài viết 9',
                'category_id' => $cat1->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
