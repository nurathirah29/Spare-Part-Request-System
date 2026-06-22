import os
import pytds
import smtplib
import secrets
import logging
import traceback
import mysql.connector
from flask_cors import CORS
from functools import wraps
from datetime import datetime
from mysql.connector import Error
from email.mime.text import MIMEText
from contextlib import contextmanager
from werkzeug.utils import secure_filename
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, json, jsonify, render_template, request, redirect, url_for, session

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app, methods=['GET', 'POST', 'PUT', 'DELETE'])

app.secret_key = secrets.token_hex(16)

ADMIN_EMP_ID = 'ADMIN'

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'images')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

logging.info(f"Upload folder configured at: {UPLOAD_FOLDER}")

EMAIL_ADDRESS = 'example@example.com'
EMAIL_PASSWORD = ''
SMTP_SERVER = 'example-mail.example.com'
SMTP_PORT = 587

RECIPIENT_REPORT_MAPPING = {
    'CS': 'cs@example.com',
    'IT': 'it@example.com'
}

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='sprs_db',
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            use_unicode=True
        )
        if connection.is_connected():
            logging.info("Database connection successful")
            return connection
        else:
            logging.error("Database connection failed")
            return None
    except Error as e:
        logging.error(f"Error in database connection: {e}")
        return None

MSSQL_CONFIG = {
    'server': 'localhost',
    'database': 'ms_db',
    'user': 'root',
    'password': '',
}

def get_mssql_connection():
    try:
        return pytds.connect(
            server=MSSQL_CONFIG['server'],
            database=MSSQL_CONFIG['database'],
            user=MSSQL_CONFIG['user'],
            password=MSSQL_CONFIG['password']
        )

    except Exception as e:
        logging.error(f"MSSQL connection error: {e}")
        return None

def ensure_upload_folder_exists():
    upload_folder = app.config['UPLOAD_FOLDER']
    
    # Log the absolute path
    abs_path = os.path.abspath(upload_folder)
    logging.info(f"Upload folder absolute path: {abs_path}")
    
    if not os.path.exists(upload_folder):
        try:
            os.makedirs(upload_folder, mode=0o755, exist_ok=True)
            logging.info(f"Created upload folder: {upload_folder}")
        except Exception as e:
            logging.error(f"Failed to create upload folder: {e}")
            raise
    
    # Verify the folder is writable
    if not os.access(upload_folder, os.W_OK):
        logging.error(f"Upload folder is not writable: {upload_folder}")
        raise PermissionError(f"Upload folder is not writable: {upload_folder}")
    
    logging.info(f"Upload folder verified and writable: {upload_folder}")
    return upload_folder

@contextmanager
def get_db_cursor():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        yield cursor
    finally:
        cursor.close()  
        connection.close()  

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def log_exceptions(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logging.error("Unhandled exception in %s: %s", func.__name__, e)
            logging.error(traceback.format_exc())
            return jsonify({'error': 'Internal server error'}), 500
    return wrapper

@app.route('/routes', methods=['GET'])
def list_routes():
    import urllib
    output = []
    for rule in app.url_map.iter_rules():
        methods = ','.join(rule.methods)
        url = urllib.parse.unquote(str(rule))
        line = f"{rule.endpoint:50s} {methods:20s} {url}"
        output.append(line)
    return '<br>'.join(output)

@app.route('/')
def index():
    return render_template('empCopy.html')

@app.route('/admin', methods=['GET', 'POST'])
def admin_dashboard():
    if 'logged_in' in session and session['logged_in'] == True:
        return render_template('adminCopy.html')
    else:
        return redirect(url_for('login'))

@app.route('/daily_report')
def daily_report_view():
    return render_template('daily_report.html')

@app.route('/custom_report')
def custom_report_view():
    return render_template('custom_report.html')

@app.route('/manage_item')
def manage_item_view():
    return render_template('manage_itemCopy.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        emp_id = request.form['emp_id']
        
        if emp_id == ADMIN_EMP_ID:
            session['logged_in'] = True 
            return redirect(url_for('admin_dashboard'))
        else:
            return "Invalid Employee ID!"
    
    return render_template('admin_login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

# Employee details
@app.route('/api/employee/<emp_id>', methods=['GET'])
def get_employee_details(emp_id):
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM employee WHERE emp_id = %s", (emp_id,))
            employee = cursor.fetchone()

            if employee:
                return jsonify({
                    'emp_id': employee['emp_id'],
                    'emp_name': employee['emp_name'],
                    'emp_dept': employee['emp_dept']
                })
            else:
                return jsonify({'error': 'Employee not found'}), 404
    except Error as e:
        logging.error(f"Error fetching employee details: {e}")
        return jsonify({'error': f'An error occurred: {e}'}), 500
    
@app.route('/api/items', methods=['GET'])
def get_all_items():
    try:
        search_query = request.args.get('search', '').strip()
        category_filter = request.args.get('category', 'all')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        detailed = request.args.get('detailed', 'false').lower() == 'true'
        
        with get_db_cursor() as cursor:
            where_conditions = []
            params = []

            if search_query:
                where_conditions.append("(LOWER(item_name) LIKE %s OR LOWER(catalog_number) LIKE %s)")
                search_param = f"%{search_query.lower()}%"
                params.extend([search_param, search_param])

            if category_filter and category_filter != 'all':
                where_conditions.append("category = %s")
                params.append(category_filter)

            where_clause = ""
            if where_conditions: 
                where_clause = "WHERE " + " AND ".join(where_conditions)

            if detailed:
                offset = (page - 1) * per_page
                
                count_query = f"SELECT COUNT(*) as total FROM item {where_clause}"
                cursor.execute(count_query, params)
                total_items = cursor.fetchone()['total']

                items_query = f"""
                    SELECT catalog_number, item_name, category, unit_uom, item_image
                    FROM item {where_clause}
                    ORDER BY catalog_number
                    LIMIT %s OFFSET %s
                """
                cursor.execute(items_query, params + [per_page, offset])
                items = cursor.fetchall()

                # ✅ Batch fetch on_hand_qty from MSSQL
                on_hand_map = {}
                try:
                    mssql_conn = get_mssql_connection()
                    if mssql_conn and items:
                        mssql_cursor = mssql_conn.cursor()
                        catalog_numbers = [item['catalog_number'] for item in items]
                        placeholders = ', '.join(['%s'] * len(catalog_numbers))
                        mssql_cursor.execute(f"""
                            SELECT CATALOG_NO, ON_HAND_QTY 
                            FROM INV_INVENTORY_MASTER_FILE 
                            WHERE CATALOG_NO IN ({placeholders})
                        """, catalog_numbers)
                        rows = mssql_cursor.fetchall()
                        for row in rows:
                            on_hand_map[row[0].strip()] = row[1]  # ✅ .strip() to handle whitespace
                        mssql_cursor.close()
                        mssql_conn.close()
                        logging.info(f"MSSQL on_hand_map keys: {list(on_hand_map.keys())}")
                        logging.info(f"MySQL catalog_numbers: {catalog_numbers}")
                except Exception as mssql_err:
                    logging.warning(f"MSSQL batch lookup failed: {mssql_err}")

                formatted_items = []
                for item in items:
                    item_image_url = None
                    if item['item_image']:
                        item_image_url = f"/static/images/{item['item_image']}"
                    
                    formatted_items.append({
                        'catalog_number': item['catalog_number'],
                        'item_name': item['item_name'],
                        'category': item['category'],
                        'unit_uom': item['unit_uom'],
                        'item_image': item_image_url,
                        'on_hand_qty': on_hand_map.get(item['catalog_number'].strip())  # ✅ .strip() on lookup too
                    })

                total_pages = (total_items + per_page - 1) // per_page

                return jsonify({
                    'items': formatted_items,
                    'total_pages': total_pages,
                    'page': page,
                    'total_items': total_items
                })
            
            else:
                if search_query:
                    items_query = f"""
                        SELECT catalog_number, item_name, item_image 
                        FROM item {where_clause}
                        ORDER BY catalog_number
                    """
                    cursor.execute(items_query, params)
                else:
                    cursor.execute("SELECT catalog_number, item_name, item_image FROM item ORDER BY catalog_number LIMIT 10")
                
                items = cursor.fetchall()

                results = []
                for item in items:
                    results.append({
                        'catalog_number': item['catalog_number'],
                        'item_name': item['item_name'],
                        'item_image': f"/static/images/{item['item_image']}" if item['item_image'] else None
                    })

                return jsonify(results)
            
    except Exception as e:
        logging.error(f"Error fetching items: {e}")
        return jsonify({'error': 'An error occurred while fetching items'}), 500
    
@app.route('/api/item/<string:catalog_number>', methods=['GET'])
def get_item_details(catalog_number):
    try:
        detailed = request.args.get('detailed', 'true').lower() == 'true'

        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM item WHERE catalog_number = %s", (catalog_number,))
            item = cursor.fetchone()

            if not item:
                return jsonify({'error': 'Item not found'}), 404

            item_image_url = f"/static/images/{item['item_image']}" if item['item_image'] else None

            # ✅ Fetch on_hand_qty from MSSQL
            on_hand_qty = None
            try:
                mssql_conn = get_mssql_connection()
                if mssql_conn:
                    mssql_cursor = mssql_conn.cursor()
                    mssql_cursor.execute("""
                        SELECT ON_HAND_QTY 
                        FROM INV_INVENTORY_MASTER_FILE 
                        WHERE CATALOG_NO = %s
                    """, (catalog_number,))
                    row = mssql_cursor.fetchone()
                    if row:
                        on_hand_qty = row[0]
                    mssql_cursor.close()
                    mssql_conn.close()
            except Exception as mssql_err:
                logging.warning(f"MSSQL lookup failed for {catalog_number}: {mssql_err}")

            return jsonify({
                'catalog_number': item['catalog_number'],
                'item_name': item['item_name'],
                'category': item['category'],
                'item_image': item_image_url,
                'unit_uom': item['unit_uom'],
                'on_hand_qty': on_hand_qty 
            })

    except Exception as e:
        logging.error(f"Error fetching item: {e}")
        return jsonify({'error': 'An error occurred while fetching item details'}), 500

@app.route('/api/item/update_quantity', methods=['POST'])
def update_item_quantity():
    data = request.get_json()
    catalog_number = data.get('catalog_number')
    quantity = data.get('quantity')

    if not catalog_number or quantity is None or not isinstance(quantity, int) or quantity <= 0:
        return jsonify({'error': 'Catalog number and a positive integer quantity are required'}), 400

    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT quantity FROM item WHERE catalog_number = %s", (catalog_number,))
            item = cursor.fetchone()

            if not item:
                return jsonify({'error': 'Item not found'}), 404

            new_quantity = item['quantity'] + quantity
            cursor.execute("UPDATE item SET quantity = %s WHERE catalog_number = %s", (new_quantity, catalog_number))
            return jsonify({'message': 'Item quantity updated successfully'}), 200
    except Error as e:
        logging.error(f"Error updating item quantity: {e}")
        return jsonify({'error': 'An error occurred while updating item quantity'}), 500
    
@app.route('/api/departments', methods=['GET'])
def get_all_departments():
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM department")
            departments = cursor.fetchall()

            if departments:
                return jsonify([{
                    'dept_id': dept['dept_id'],
                    'dept_name': dept['dept_name']
                } for dept in departments]), 200
            else:
                return jsonify({'error': 'No departments found'}), 404
    except Error as e:
        logging.error(f"Error fetching departments: {e}")
        return jsonify({'error': 'An error occurred while fetching department details'}), 500
    
@app.route('/api/department/<string:dept_id>', methods=['GET'])
def get_department(dept_id):
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM department WHERE dept_id = %s", (dept_id,))
            department = cursor.fetchone()

            if department:
                return jsonify({
                    'valid': True,
                    'dept_id': department['dept_id'],
                    'dept_name': department['dept_name']
                }), 200
            return jsonify({'error': 'Department not found'}), 404
    except Error as e:
        logging.error(f"Error fetching department: {e}")
        return jsonify({'error': 'An error occurred while fetching department details'}), 500

@app.route('/api/remove_item/<string:catalog_number>', methods=['POST'])
def remove_item(catalog_number):
    try:
        with get_db_cursor() as cursor:
            cursor.execute("UPDATE item SET quantity = quantity - 1 WHERE catalog_number = %s", (catalog_number,))
            return jsonify({'message': 'Item removed successfully'})
    except Error as e:
        logging.error(f"Error removing item: {e}")
        return jsonify({'error': 'An error occurred while removing item'}), 500

@app.route('/api/transaction', methods=['POST'])
@log_exceptions
def submit_transaction():
    data = request.get_json()

    logging.info("Received transaction payload: %s", json.dumps(data, indent=2))

    emp_id = data.get('emp_id')
    items = data.get('items')
    remark = data.get('remark', '')

    if not emp_id or not isinstance(emp_id, str):
        return jsonify({'error': 'Invalid or missing employee ID'}), 400

    if not items or not isinstance(items, list):
        return jsonify({'error': 'Invalid or missing items list'}), 400

    try:
        with get_db_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                # Validate employee
                cursor.execute("SELECT * FROM employee WHERE emp_id = %s", (emp_id,))
                employee = cursor.fetchone()
                if not employee:
                    return jsonify({'error': 'Employee not found'}), 404

                # Generate transaction ID (before checking for duplicates)
                current_date = datetime.now().strftime('%y%m%d')
                cursor.execute("SELECT COUNT(*) AS count FROM transactions WHERE DATE(transaction_date) = %s", (current_date,))
                transaction_count = cursor.fetchone()['count']
                transaction_id = f"{current_date.replace('-', '')}-{employee['emp_dept']}-{str(transaction_count + 1).zfill(3)}"

                # Check for duplicate transaction using the newly generated ID
                cursor.execute(""" 
                    SELECT t.transaction_id 
                    FROM transactions t 
                    JOIN transaction_detail td ON t.transaction_id = td.transaction_id
                    WHERE t.emp_id = %s AND DATE(t.transaction_date) = %s AND t.transaction_id = %s
                """, (emp_id, current_date, transaction_id))
                if cursor.fetchone():
                    return jsonify({'error': 'Duplicate transaction detected', 'transaction_id': transaction_id}), 409

                # Insert transaction
                cursor.execute("""
                    INSERT INTO transactions (transaction_id, emp_id, transaction_date, status, remark) 
                    VALUES (%s, %s, %s, 'Pending', %s)
                """, (transaction_id, emp_id, current_date, remark))

                # Process each item
                for i, item in enumerate(items):
                    required_fields = ['catalog_number', 'item_name', 'quantity', 'department']
                    missing = [f for f in required_fields if not item.get(f)]
                    if missing:
                        return jsonify({'error': f"Item {i+1} is missing: {', '.join(missing)}"}), 400

                    catalog_number = item['catalog_number']
                    item_name = item['item_name']
                    quantity_raw = item['quantity']
                    dept_id = item['department']
                    quantity_str = ''.join(filter(str.isdigit, quantity_raw))
                    if not quantity_str:
                        return jsonify({'error': f"Item {i+1}: invalid quantity format"}), 400

                    quantity = int(quantity_str)
                    if quantity <= 0:
                        return jsonify({'error': f"Item {i+1}: quantity must be > 0"}), 400

                    # Item and department existence checks
                    cursor.execute("SELECT unit_uom FROM item WHERE catalog_number = %s", (catalog_number,))
                    if not cursor.fetchone():
                        return jsonify({'error': f"Item {i+1}: catalog number not found"}), 404

                    cursor.execute("SELECT dept_id FROM department WHERE dept_id = %s", (dept_id,))
                    if not cursor.fetchone():
                        return jsonify({'error': f"Item {i+1}: department not found"}), 404

                    # Insert item
                    cursor.execute("""
                        INSERT INTO transaction_detail (transaction_id, catalog_number, item_name, quantity, dept_id, item_status)
                        VALUES (%s, %s, %s, %s, %s, 'Approve')
                    """, (transaction_id, catalog_number, item_name, quantity, dept_id))

                connection.commit()
                return jsonify({'success': True, 'transaction_id': transaction_id, 'message': 'Transaction submitted successfully'})

    except Exception as e:
        logging.error("Transaction submission failed: %s", e)
        logging.error(traceback.format_exc())
        return jsonify({'error': 'An internal server error occurred'}), 500

@app.route('/api/admin/transactions', methods=['GET'])
def admin_get_all_transactions():
    try:
        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search')
        all_records = request.args.get('all_records', 'false').lower() == 'true'
        page = int(request.args.get('page', 1))

        # Default pagination logic
        limit = 9
        offset = (page - 1) * limit

        # Main query to fetch transactions
        query = """
            SELECT t.transaction_id, t.emp_id, e.emp_name, e.emp_dept, t.status, t.remark, t.transaction_date
            FROM transactions t
            JOIN employee e ON t.emp_id = e.emp_id
            LEFT JOIN transaction_detail td ON t.transaction_id = td.transaction_id
            LEFT JOIN item i ON td.catalog_number = i.catalog_number
            WHERE 1=1
        """
        params = []

        if status:
            query += " AND t.status = %s"
            params.append(status)

        if start_date and end_date:
            query += " AND t.transaction_date BETWEEN %s AND %s"
            params.extend([start_date, end_date])

        if search:
            query += """
                AND (t.transaction_id LIKE %s OR e.emp_id LIKE %s OR e.emp_dept LIKE %s OR i.item_name LIKE %s)
            """
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

        if not all_records:
            query += " GROUP BY t.transaction_id ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT %s OFFSET %s "
            params.extend([limit, offset])
        else:
            query += " GROUP BY t.transaction_id ORDER BY t.transaction_date DESC, t.transaction_id DESC "

        with get_db_cursor() as cursor:
            cursor.execute(query, tuple(params))
            transactions = cursor.fetchall()

            if not transactions:
                logging.info("No transactions found.")
                transactions = []

            if not all_records:
                count_query = """
                    SELECT COUNT(DISTINCT t.transaction_id) AS total_count
                    FROM transactions t
                    JOIN employee e ON t.emp_id = e.emp_id
                    LEFT JOIN transaction_detail td ON t.transaction_id = td.transaction_id
                    LEFT JOIN item i ON td.catalog_number = i.catalog_number
                    WHERE 1=1
                """
                count_params = []

                if status:
                    count_query += " AND t.status = %s"
                    count_params.append(status)

                if start_date and end_date:
                    count_query += " AND t.transaction_date BETWEEN %s AND %s"
                    count_params.extend([start_date, end_date])

                if search:
                    count_query += """
                        AND (t.transaction_id LIKE %s OR e.emp_id LIKE %s OR e.emp_dept LIKE %s OR i.item_name LIKE %s)
                    """
                    count_params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])

                cursor.execute(count_query, tuple(count_params))
                count_result = cursor.fetchone()
                total_count = count_result[0] if isinstance(count_result, tuple) else count_result.get('total_count', 0)

                total_pages = (total_count // limit) + (1 if total_count % limit > 0 else 0)
                pagination = {
                    'total_count': total_count,
                    'total_pages': total_pages,
                    'current_page': page,
                    'per_page': limit
                }
            else:
                pagination = None

            for txn in transactions:
                if txn['transaction_date']:
                    txn['transaction_date'] = txn['transaction_date'].strftime('%Y-%m-%d')

            for txn in transactions:
                txn['details'] = []
                txn_details_query = """
                    SELECT td.catalog_number, i.item_name, td.quantity, i.unit_uom, td.dept_id, td.item_status
                    FROM transaction_detail td
                    LEFT JOIN item i ON td.catalog_number = i.catalog_number
                    WHERE td.transaction_id = %s
                """
                cursor.execute(txn_details_query, (txn['transaction_id'],))
                txn['details'] = cursor.fetchall()

                logging.info(f"Transaction ID {txn['transaction_id']} details: {txn['details']}")

            return jsonify({
                'transactions': transactions,
                'pagination': pagination
            })

    except Exception as e:
        logging.error(f"Error fetching transactions: {e}")
        return jsonify({'error': 'An error occurred while fetching transactions'}), 500
    
# Route to Get Transaction by ID for Admin View
@app.route('/api/admin/transactions/<transaction_id>', methods=['GET'])
def admin_get_transactions(transaction_id):
    logging.debug(f"Received request for transaction_id: {transaction_id}")
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT t.transaction_id, t.emp_id, e.emp_name, e.emp_dept, t.status, t.remark, t.transaction_date
                FROM transactions t
                JOIN employee e ON t.emp_id = e.emp_id
                WHERE t.transaction_id = %s
            """, (transaction_id,))
            txn = cursor.fetchone()

            if not txn:
                logging.warning(f"Transaction with ID {transaction_id} not found")
                return jsonify({'error': 'Transaction not found'}), 404

            cursor.execute("""
                SELECT td.transaction_id, td.catalog_number, i.item_name, td.quantity, td.dept_id, td.item_status, i.unit_uom, i.item_image
                FROM transaction_detail td
                JOIN item i ON td.catalog_number = i.catalog_number
                WHERE td.transaction_id = %s
            """, (transaction_id,))
            transaction_detail = cursor.fetchall()

            for detail in transaction_detail:
                detail['item_image'] = f"/static/images/{detail['item_image']}"

            # ✅ Batch fetch on_hand_qty from MSSQL
            on_hand_map = {}
            try:
                mssql_conn = get_mssql_connection()
                if mssql_conn and transaction_detail:
                    mssql_cursor = mssql_conn.cursor()
                    catalog_numbers = [d['catalog_number'] for d in transaction_detail]
                    placeholders = ', '.join(['%s'] * len(catalog_numbers))
                    mssql_cursor.execute(f"""
                        SELECT CATALOG_NO, ON_HAND_QTY
                        FROM INV_INVENTORY_MASTER_FILE
                        WHERE CATALOG_NO IN ({placeholders})
                    """, catalog_numbers)
                    rows = mssql_cursor.fetchall()
                    for row in rows:
                        on_hand_map[row[0].strip()] = row[1]
                    mssql_cursor.close()
                    mssql_conn.close()
                    logging.info(f"MSSQL on_hand_map keys: {list(on_hand_map.keys())}")
                    logging.info(f"MySQL catalog_numbers: {catalog_numbers}")
            except Exception as mssql_err:
                logging.warning(f"MSSQL batch lookup failed for transaction {transaction_id}: {mssql_err}")

            for detail in transaction_detail:
                detail['on_hand_qty'] = on_hand_map.get(detail['catalog_number'].strip())

            if txn['transaction_date']:
                txn['transaction_date'] = txn['transaction_date'].strftime('%Y-%m-%d')

            result = {
                'transaction_id': txn['transaction_id'],
                'emp_id': txn['emp_id'],
                'emp_name': txn['emp_name'],
                'emp_dept': txn['emp_dept'] or '',
                'status': txn['status'],
                'remark': txn['remark'],
                'transaction_date': txn['transaction_date'],
                'details': transaction_detail
            }

            return jsonify(result)
        
    except Error as e:
        logging.error(f"Error fetching transaction {transaction_id}: {e}")
        return jsonify({'error': f'An error occurred while fetching transaction {transaction_id}'}), 500

# Route to Update Transaction by ID
@app.route('/api/admin/update_transaction/<transaction_id>', methods=['PUT'])
def update_transaction(transaction_id):
    connection = None
    cursor = None
    try:
        transaction_data = request.get_json()
        # print("Received data:", transaction_data)

        # Validate input data
        if not transaction_data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['status', 'remark', 'items']
        for field in required_fields:
            if field not in transaction_data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        valid_statuses = ['Pending', 'Approve', 'On Hold', 'Cancel']
        if transaction_data['status'] not in valid_statuses:
            return jsonify({"error": f"Invalid status: {transaction_data['status']}"}), 400

        if not transaction_data['items']:
            return jsonify({"error": "Transaction must contain at least one item"}), 400

        connection = get_db_connection()
        if connection is None:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor(dictionary=True)

        cursor.execute("""SELECT status FROM transactions WHERE transaction_id = %s""", (transaction_id,))
        transaction = cursor.fetchone()

        if not transaction:
            cursor.close()
            connection.close()
            return jsonify({"error": "Transaction not found"}), 404

        # print(f"Updating transaction {transaction_id} with status: {transaction_data['status']} and remark: {transaction_data['remark']}")

        cursor.execute(""" 
            UPDATE transactions 
            SET status = %s, remark = %s 
            WHERE transaction_id = %s
        """, (transaction_data['status'], transaction_data['remark'], transaction_id))

        # If status is "Pending", update item_status to "Approve"
        if transaction_data['status'] == 'Pending':
            cursor.execute("""
                UPDATE transaction_detail
                SET item_status = 'Approve'
                WHERE transaction_id = %s
            """, (transaction_id,))
        # If status is "Cancel", update item_status to "Cancel"
        elif transaction_data['status'] == 'Cancel':
            cursor.execute(""" 
                UPDATE transaction_detail 
                SET item_status = 'Cancel' 
                WHERE transaction_id = %s
            """, (transaction_id,))

        for updated_item in transaction_data['items']:
            # print(f"Processing item: {updated_item}")

            if 'catalog_number' not in updated_item or 'quantity' not in updated_item:
                return jsonify({"error": "Missing catalog number or quantity in item"}), 400

            if 'item_status' not in updated_item:
                return jsonify({"error": "Missing item status for the item"}), 400

            if updated_item['item_status'] not in ['Pending', 'Approve', 'Cancel']:
                return jsonify({"error": f"Invalid item status for item: {updated_item.get('catalog_number', 'Unknown')}" }), 400

            # Validate quantity
            try:
                quantity = int(updated_item['quantity'])
                if quantity <= 0:
                    return jsonify({"error": f"Invalid quantity for item: {updated_item.get('catalog_number', 'Unknown')}"}), 400
            except (ValueError, TypeError):
                return jsonify({"error": f"Invalid quantity format for item: {updated_item.get('catalog_number', 'Unknown')}"}), 400

            item_status = updated_item['item_status']
            if transaction_data['status'] == 'Pending' and updated_item['item_status'] != 'Cancel':
                item_status = 'Approve'
            elif transaction_data['status'] == 'Cancel':
                item_status = 'Cancel'

            dept_id = updated_item.get('dept_id', 'DEFAULT_DEPT')

            cursor.execute("""
                SELECT COUNT(*) as count FROM transaction_detail
                WHERE transaction_id = %s AND catalog_number = %s AND dept_id = %s
            """,(transaction_id, updated_item['catalog_number'], dept_id))

            result = cursor.fetchone()
            record_exists = result['count'] > 0

            if record_exists:
                # Update existing record
                # print(f"Updating existing record for catalog_number: {updated_item['catalog_number']}")
                cursor.execute("""
                    UPDATE transaction_detail 
                    SET quantity = %s, item_status = %s
                    WHERE transaction_id = %s AND catalog_number = %s AND dept_id = %s
                """, (quantity, item_status, transaction_id, updated_item['catalog_number'], dept_id)) 
                logging.info(f"Updating item: catalog_number={updated_item['catalog_number']}, quantity={quantity}, item_status={item_status}, dept_id={dept_id}")
            else:
                # Insert new record
                # print(f"Inserting new record for catalog_number: {updated_item['catalog_number']}")
                cursor.execute("""
                    INSERT INTO transaction_detail (transaction_id, catalog_number, quantity, dept_id, item_status)
                    VALUES (%s, %s, %s, %s, %s)
                """, (transaction_id, updated_item['catalog_number'], quantity, dept_id, item_status))

        connection.commit()

        # status is "Approve", handle approval
        if transaction_data['status'] == 'Approve':
            approve_transaction(transaction_id)

        cursor.execute(""" 
            SELECT td.transaction_id, td.catalog_number, td.quantity, td.dept_id, td.item_status, i.unit_uom
            FROM transaction_detail td
            JOIN item i ON td.catalog_number = i.catalog_number
            WHERE td.transaction_id = %s
        """, (transaction_id,))
        updated_transaction_details = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({
            "message": "Transaction updated successfully",
            "transaction_details": updated_transaction_details
        }), 200

    except Exception as e:
        print(f"Error in update_transaction: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        
        if connection:
            try:
                connection.rollback()
                print("Transaction rolled back")
            except Exception as rollback_error:
                print(f"Rollback failed: {rollback_error}")
        
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
        print("Database resources cleaned up")

@app.route('/api/admin/daily_transactions', methods=['GET'])
def admin_get_daily_transactions():
    try:
        date_param = request.args.get('date')
        today = date_param or datetime.today().strftime('%Y-%m-%d')
        logging.info(f"Fetching transactions for date: {today}")

        query = """
            SELECT t.transaction_id, td.catalog_number, i.item_name, td.quantity, i.unit_uom,
                   td.dept_id, e.emp_dept, t.emp_id, t.remark, t.transaction_date, td.item_status
            FROM transactions t
            JOIN employee e ON t.emp_id = e.emp_id
            LEFT JOIN transaction_detail td ON t.transaction_id = td.transaction_id
            LEFT JOIN item i ON td.catalog_number = i.catalog_number
            WHERE DATE(t.transaction_date) = %s
            ORDER BY t.transaction_date DESC
        """
        params = [today]

        logging.info(f"Executing query: {query} with params: {params}")

        with get_db_cursor() as cursor:
            cursor.execute(query, params)
            transactions = cursor.fetchall()

            for txn in transactions:
                if txn['transaction_date']:
                    txn['transaction_date'] = txn['transaction_date'].strftime('%Y-%m-%d')
                else:
                    txn['transaction_date'] = None

            return jsonify(transactions)

    except Exception as e:
        logging.error(f"Error fetching daily transactions: {e}")
        return jsonify({'error': 'An error occurred while fetching daily transactions'}), 500
    
@app.route('/approve_transaction', methods=['POST'])
def approve_transaction_route():
    print("approve_transaction_route called")
    data = request.json
    transaction_id = data.get('transaction_id')
    if not transaction_id:
        return {'error': 'Transaction ID is required'}, 400

    approve_transaction(transaction_id)
    return {'message': f'Transaction {transaction_id} approved and email sent.'}, 200

def approve_transaction(transaction_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        if connection is None:
            print("Failed to get DB connection.")
            return

        with connection.cursor(dictionary=True) as cursor:
            update_query = "UPDATE transactions SET status = 'Approve' WHERE transaction_id = %s"
            cursor.execute(update_query, (transaction_id,))
            connection.commit()
            print(f"Transaction {transaction_id} is approved.")
        
            fetch_query = """
                SELECT t.transaction_date, t.transaction_id, t.emp_id, t.remark, e.emp_name,  e.emp_dept,
                        i.item_name, i.unit_uom, td.catalog_number, td.quantity, td.dept_id, td.item_status
                FROM transactions t
                JOIN employee e ON t.emp_id = e.emp_id
                LEFT JOIN transaction_detail td ON t.transaction_id = td.transaction_id
                LEFT JOIN item i ON td.catalog_number = i.catalog_number
                WHERE t.transaction_id = %s
                ORDER BY t.transaction_date DESC
            """
            cursor.execute(fetch_query, [transaction_id])
            transaction = cursor.fetchone()

            if not transaction:
                print(f"Transaction {transaction_id} not found.")
                return
            
            dept_id = transaction['emp_dept']
            
            recipient_email = RECIPIENT_REPORT_MAPPING.get(dept_id)

            if recipient_email:
                send_email(recipient_email, dept_id, [transaction])
                print(f"Email sent to {recipient_email} for transaction {transaction_id}.")
            else:
                print(f"No recipient email found for department {dept_id}.")

            update_email_status(transaction_id)

    except Exception as e:
        print(f"Error approving transaction {transaction_id}: {e}")

def send_email(recipient_email, department_name, transactions):
    subject = f"Approved Transactions - {department_name} Department"
    body = "<p>The following transaction has been approved:</p>"
    body += "<table border='1' style='border-collapse: collapse;'>"
    headers = ["No.", "Transaction Date", "Reference Number", "Catalog Number", "Item Name", 
               "Quantity", "Employee ID", "Employee Name", "Request Section", "Remark", "Item Status"]

    # Add table headers
    body += "<tr>"
    for header in headers:
        body += f"<th style='padding: 8px; background-color: #f2f2f2;'>{header}</th>"
    body += "</tr>"

    # Add table rows
    for idx, row in enumerate(transactions, start=1):
        body += "<tr>"
        body += f"<td style='padding: 8px;'>{idx}</td>"
        body += f"<td style='padding: 8px;'>{row['transaction_date']}</td>"
        body += f"<td style='padding: 8px;'>{row['transaction_id']}</td>"
        body += f"<td style='padding: 8px;'>{row['catalog_number']}</td>"

        # Handle special characters in item name
        item_name = str(row['item_name']) if row['item_name'] else 'N/A'
        # Replace problematic characters or encode them properly
        item_name = item_name.replace('Ø', '&Oslash;')  # HTML entity for Ø
        body += f"<td style='padding: 8px;'>{item_name}</td>"

        quantity = row['quantity'] if row['quantity'] else 0
        unit_uom = str(row['unit_uom']) if row['unit_uom'] else ''
        body += f"<td style='padding: 8px;'>{quantity} {unit_uom}</td>"
        
        body += f"<td style='padding: 8px;'>{row['emp_id']}</td>"
        body += f"<td style='padding: 8px;'>{row['emp_name']}</td>"
        body += f"<td style='padding: 8px;'>{row['dept_id']}</td>"  # Request Section
        body += f"<td style='padding: 8px;'>{row['remark']}</td>"
        body += f"<td style='padding: 8px;'>{row['item_status']}</td>"
        body += "</tr>"

    body += "</table>"

    # Email configuration
    msg = MIMEMultipart()
    msg.set_charset('utf-8')
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = recipient_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html', 'utf-8'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        server.sendmail(EMAIL_ADDRESS, recipient_email, msg.as_string())
        server.quit()
        print(f"Email sent successfully to {recipient_email}.")
    except Exception as e:
        print(f"Error sending email: {e}")

def update_email_status(transaction_id):
    connection = None
    cursor = None
    
    try:
        connection = get_db_connection()
        if connection is None:
            print("Failed to get DB connection.")
            return
        
        cursor = connection.cursor(dictionary=True)
        query = "UPDATE transactions SET approval_email_sent = 1 WHERE transaction_id = %s"
        
        cursor.execute(query, (transaction_id,))
        connection.commit()
        print(f"Marked transaction {transaction_id} as email sent.")
    
    except Exception as e:
        print(f"Error updating transaction email status: {e}")
    
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# Manage Items Page
@app.route('/add_item', methods=['POST'])
def add_item():
    catalog_number = request.form.get('catalog_number')
    item_name = request.form.get('item_name')
    category = request.form.get('category')
    unit_uom = request.form.get('unit_uom')
    file = request.files.get('item_image')

    # Validate required fields
    if not (catalog_number and item_name and unit_uom):
        return jsonify({'error': 'Missing required fields'}), 400

    # Ensure upload folder exists
    upload_folder = ensure_upload_folder_exists()
    
    new_file_name = None
    connection = get_db_connection()

    try:
        with connection.cursor(dictionary=True) as cursor:
            # Check if catalog number already exists
            cursor.execute("SELECT catalog_number FROM item WHERE catalog_number = %s", (catalog_number,))
            if cursor.fetchone():
                return jsonify({'error': 'Catalog number already exists'}), 400

            # Handle file upload (if any)
            if file and file.filename and file.filename != '':
                if not allowed_file(file.filename):
                    return jsonify({'error': 'Invalid file type'}), 400
                
                logging.info(f"Processing file upload: {file.filename}")

                # Get max file number from existing images
                cursor.execute("""
                    SELECT item_image FROM item 
                    WHERE item_image IS NOT NULL AND item_image != ''
                    ORDER BY item_image DESC
                """)
                existing_images = cursor.fetchall()
                
                max_image_number = 445  # Default starting number
                
                # Extract numbers from existing image filenames
                for img in existing_images:
                    if img['item_image']:
                        # Extract number from filename like "C446.jpg"
                        filename = img['item_image']
                        if filename.startswith('C') and '.' in filename:
                            try:
                                number_part = filename[1:filename.rfind('.')]
                                number = int(number_part)
                                if number > max_image_number:
                                    max_image_number = number
                            except ValueError:
                                continue

                # Create new file name with incremented number
                new_file_number = max_image_number + 1
                file_extension = file.filename.rsplit('.', 1)[-1].lower()
                new_file_name = f"C{new_file_number}.{file_extension}"

                # Save file to filesystem 
                filename = secure_filename(new_file_name)
                file_path = os.path.join(upload_folder, filename)
                
                try:
                    file.save(file_path)
                    logging.info(f"File saved successfully to: {file_path}")
                    
                    # Verify file was actually saved
                    if not os.path.exists(file_path):
                        raise Exception(f"File was not saved to {file_path}")
                        
                except Exception as e:
                    logging.error(f"Error saving file: {e}")
                    return jsonify({'error': f'Failed to save image file: {str(e)}'}), 500

            # Insert new item into database
            cursor.execute("""
                INSERT INTO item (catalog_number, item_name, category, item_image, unit_uom)
                VALUES (%s, %s, %s, %s, %s)
            """, (catalog_number, item_name, category, new_file_name, unit_uom))
            connection.commit()
            
            logging.info(f"Item added successfully: {catalog_number}")

        return jsonify({
            'message': 'Item added successfully', 
            'image_url': f"/static/images/{new_file_name}" if new_file_name else None,
            'catalog_number': catalog_number
        }), 200

    except Exception as e:
        logging.error(f"Error adding item: {e}")
        if connection:
            connection.rollback()
        
        # Clean up the uploaded file if database insert failed
        if new_file_name:
            file_path = os.path.join(upload_folder, secure_filename(new_file_name))
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logging.info(f"Cleaned up file after database error: {file_path}")
                except OSError as cleanup_error:
                    logging.warning(f"Could not clean up file {file_path}: {cleanup_error}")
                    
        return jsonify({'error': 'An error occurred while adding the item'}), 500

    finally:
        if connection:
            connection.close()

@app.route('/api/item/<string:catalog_number>', methods=['PUT'])
def update_item(catalog_number):
    try: 
        catalog_number = catalog_number.strip()
        item_name = request.form.get('item_name', '').strip()
        category = request.form.get('category', '').strip()
        unit_uom = request.form.get('unit_uom', '').strip()
        new_catalog_number = request.form.get('catalog_number', '').strip()
        file = request.files.get('item_image')

        if not (new_catalog_number and item_name and unit_uom):
            return jsonify({'error': 'Missing required fields'}), 400

        # Ensure upload folder exists
        upload_folder = ensure_upload_folder_exists()
        
        connection = get_db_connection()
        new_file_name = None

        try:
            with connection.cursor(dictionary=True) as cursor:
                cursor.execute("SELECT * FROM item WHERE catalog_number = %s", (catalog_number,))
                existing_item = cursor.fetchone()

                if not existing_item:
                    return jsonify({'error': 'Item not found'}), 404
                
                logging.info(f"Updating item: original={catalog_number}, new={new_catalog_number}")

                # Check if new catalog number conflicts with existing items
                if new_catalog_number != catalog_number:
                    cursor.execute("SELECT catalog_number FROM item WHERE catalog_number = %s AND catalog_number != %s", (new_catalog_number, catalog_number))
                    if cursor.fetchone():
                        return jsonify({'error': 'Catalog number already exists'}), 400

                # Handle file upload if new file provided
                if file and file.filename and file.filename.strip() != '':
                    if not allowed_file(file.filename):
                        return jsonify({'error': 'Invalid file type'}), 400

                    logging.info(f"Processing file upload for update: {file.filename}")

                    # Remove old file if it exists
                    if existing_item['item_image']:
                        old_file_path = os.path.join(upload_folder, existing_item['item_image'])
                        if os.path.exists(old_file_path):
                            try:
                                os.remove(old_file_path)
                                logging.info(f"Removed old file: {old_file_path}")
                            except OSError as e:
                                logging.warning(f"Could not remove old file {old_file_path}: {e}")

                    # Get max file number for new image
                    cursor.execute("""
                        SELECT item_image FROM item 
                        WHERE item_image IS NOT NULL AND item_image != ''
                        ORDER BY item_image DESC
                    """)
                    existing_images = cursor.fetchall()
                    
                    max_image_number = 445
                    
                    # Extract numbers from existing image filenames
                    for img in existing_images:
                        if img['item_image']:
                            filename = img['item_image']
                            if filename.startswith('C') and '.' in filename:
                                try:
                                    number_part = filename[1:filename.rfind('.')]
                                    number = int(number_part)
                                    if number > max_image_number:
                                        max_image_number = number
                                except ValueError:
                                    continue

                    # Create new file name
                    new_file_number = max_image_number + 1
                    file_extension = file.filename.rsplit('.', 1)[-1].lower()
                    new_file_name = f"C{new_file_number}.{file_extension}"

                    # Save new file
                    filename = secure_filename(new_file_name)
                    file_path = os.path.join(upload_folder, filename)
                    
                    try:
                        file.save(file_path)
                        logging.info(f"Updated file saved to: {file_path}")
                        
                        # Verify file was saved
                        if not os.path.exists(file_path):
                            raise Exception(f"File was not saved to {file_path}")
                            
                    except Exception as e:
                        logging.error(f"Error saving updated file: {e}")
                        return jsonify({'error': f'Failed to save image file: {str(e)}'}), 500
                else:
                    # Keep existing image
                    new_file_name = existing_item['item_image']

                # Update item in database
                cursor.execute("""
                    UPDATE item
                    SET catalog_number = %s, item_name = %s, category = %s, item_image = %s, unit_uom = %s
                    WHERE catalog_number = %s
                """, (new_catalog_number, item_name, category, new_file_name, unit_uom, catalog_number))
                connection.commit()
                
                logging.info(f"Item updated successfully: {new_catalog_number}")

                return jsonify({
                    'message': 'Item updated successfully',
                    'catalog_number': new_catalog_number,
                    'image_url': f"/static/images/{new_file_name}" if new_file_name else None
                }), 200

        except Exception as e:
            logging.error(f"Error updating item: {e}")
            if connection:
                connection.rollback()
            return jsonify({'error': 'An error occurred while updating the item'}), 500

        finally:
            if connection:
                connection.close()

    except Exception as e:
        logging.error(f"Error in update_item: {e}")
        return jsonify({'error': 'Invalid request'}), 400

# Route for File Upload
@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        image_url = filename

        try:
            with get_db_cursor() as cursor:
                cursor.execute("UPDATE item SET item_image = %s WHERE catalog_number = %s", 
                               (image_url, request.form['catalog_number']))
                return jsonify({'message': 'Image uploaded successfully', 'image_url': image_url}), 200
        except Error as e:
            logging.error(f"Error uploading image: {e}")
            return jsonify({'error': 'An error occurred while uploading image'}), 500
    else:
        return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/item/<string:catalog_number>', methods=['DELETE'])
def delete_item(catalog_number):
    try:
        connection = get_db_connection()
        
        try:
            with connection.cursor(dictionary=True) as cursor:
                # Check if item exists and get image info
                cursor.execute("SELECT item_image FROM item WHERE catalog_number = %s", (catalog_number,))
                item = cursor.fetchone()
                
                if not item:
                    return jsonify({'error': 'Item not found'}), 404

                # Delete associated image file if exists
                if item['item_image']:
                    image_path = os.path.join(app.config['UPLOAD_FOLDER'], item['item_image'])
                    if os.path.exists(image_path):
                        try:
                            os.remove(image_path)
                        except OSError as e:
                            app.logger.warning(f"Could not delete image file {image_path}: {e}")

                # Delete item from database
                cursor.execute("DELETE FROM item WHERE catalog_number = %s", (catalog_number,))
                connection.commit()

                if cursor.rowcount == 0:
                    return jsonify({'error': 'Item not found'}), 404

            return jsonify({'message': 'Item deleted successfully'}), 200

        except Exception as e:
            app.logger.error(f"Error deleting item: {e}")
            return jsonify({'error': 'An error occurred while deleting the item'}), 500

        finally:
            if connection:
                connection.close()

    except Exception as e:
        app.logger.error(f"Error in delete_item: {e}")
        return jsonify({'error': 'Invalid request'}), 400

if __name__ == '__main__':
    try:
        ensure_upload_folder_exists()
        logging.info("Upload folder initialization successful")
    except Exception as e:
        logging.error(f"Failed to initialize upload folder: {e}")
        logging.error("Application may not be able to save uploaded files!")
        
    app.run(host='0.0.0.0', port=8080, debug=True)
