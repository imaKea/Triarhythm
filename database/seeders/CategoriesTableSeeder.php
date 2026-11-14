<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategoriesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Thêm dữ liệu vào bảng Categories bằng Model Eloquent
        Category::create([
            'name' => 'Thế giới',
            'description' => 'Chuyên mục thông tin về Thế giới',
        ]);

        Category::create([
            'name' => 'Pháp luật',
            'description' => 'Chuyên mục thông tin về Pháp luật',
        ]);

        Category::create([
            'name' => 'Khoa học',
            'description' => 'Chuyên mục thông tin về Khoa học',
        ]);
    }
}
