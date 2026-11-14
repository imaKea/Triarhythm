<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

class PostFactory extends Factory
{
    protected $model = Post::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $category = Category::inRandomOrder()->first();

        return [
            'name' => fake()->sentence(), // Tạo tên bài viết ngẫu nhiên
            'description' => fake()->text(160), // Tạo mô tả ngẫu nhiên với độ dài 160 ký tự
            'content' => fake()->paragraph(5), // Tạo nội dung ngẫu nhiên với 5 đoạn
            'category_id' => $category ? $category->id : Category::factory(), // Lấy ngẫu nhiên một category_id từ bảng Categories
        ];
    }
}
