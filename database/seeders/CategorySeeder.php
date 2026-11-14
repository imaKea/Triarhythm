<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Sử dụng factory để tạo 10 bản ghi cho bảng Categories
        Category::factory()->count(10)->create();
    }
}
