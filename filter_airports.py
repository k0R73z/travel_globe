import csv

# Входной и выходной файлы
input_file = 'airports.csv'
output_file = 'filtered_airports.csv'

# Колонки, которые нужно оставить
columns_to_keep = ['name', 'latitude_deg', 'longitude_deg', 'iso_country', 'iata_code']

# Читаем и фильтруем данные
with open(input_file, 'r', encoding='utf-8') as infile, \
     open(output_file, 'w', encoding='utf-8', newline='') as outfile:
    
    reader = csv.DictReader(infile)
    writer = csv.DictWriter(outfile, fieldnames=columns_to_keep)
    
    # Записываем заголовок
    writer.writeheader()
    
    # Обрабатываем каждую строку
    for row in reader:
        # Проверяем, что iata_code не пустой
        if row['iata_code'] and row['iata_code'].strip():
            # Создаем новую строку только с нужными колонками
            filtered_row = {col: row[col] for col in columns_to_keep}
            writer.writerow(filtered_row)

print(f"Фильтрация завершена. Результат сохранен в {output_file}")
